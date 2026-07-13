const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const helmet = require('helmet');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const archiver = require('archiver');
const { GridFSBucket, ObjectId } = require('mongodb');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Share = require('./models/Share');

const app = express();
const maxTotalUploadMb = Number(process.env.MAX_TOTAL_UPLOAD_MB || process.env.MAX_FILE_SIZE_MB || 150);
const maxTotalUploadBytes = maxTotalUploadMb * 1024 * 1024;
const maxFilesPerShare = Number(process.env.MAX_FILES_PER_SHARE || 10);
const pinDownloadLimit = Number(process.env.PIN_DOWNLOAD_LIMIT || 10);
const shareExpiryHours = Number(process.env.SHARE_EXPIRY_HOURS || 2);
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
const adminSessionHours = Number(process.env.ADMIN_SESSION_HOURS || 12);
const allowedMimeTypes = new Set(
  (process.env.ALLOWED_UPLOAD_MIME_TYPES ||
    [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
      'application/json',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ].join(',')
  )
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean)
);

let connectionPromise;
let bucket;
const rateLimitStore = new Map();
const adminSessions = new Map();
const tempUploadDir = path.join(os.tmpdir(), 'sharefiles-uploads');
let cleanupPromise = null;
let lastCleanupStartedAt = 0;

try {
  fs.mkdirSync(tempUploadDir, { recursive: true });
} catch (error) {
  console.error('Failed to prepare upload temp directory:', error);
}

app.set('trust proxy', 1);
app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);
app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      callback(null, tempUploadDir);
    },
    filename: (req, file, callback) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`);
    }
  }),
  limits: {
    // Keep a hard ceiling equal to the total-share limit so one file can use the full allowance.
    fileSize: maxTotalUploadBytes,
    files: maxFilesPerShare
  },
  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new Error(`File type not allowed: ${file.originalname}`));
    }

    return callback(null, true);
  }
});
const uploadMany = upload.array('files', maxFilesPerShare);

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function rateLimit({ windowMs, maxRequests, message }) {
  return (req, res, next) => {
    const ip = getClientIp(req);
    const key = `${req.method}:${req.path}:${ip}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || entry.expiresAt <= now) {
      rateLimitStore.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      return res.status(429).json({ error: message });
    }

    return next();
  };
}

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function connectToDatabase() {
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sharefiles', {
        serverSelectionTimeoutMS: 10000
      })
      .then(() => {
        bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
        console.log('MongoDB connected successfully');
        return mongoose.connection;
      })
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }

  await connectionPromise;

  if (!bucket) {
    bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
  }

  return bucket;
}

function getDatabaseErrorMessage(error) {
  if (!process.env.MONGODB_URI) {
    return 'MONGODB_URI is not configured on the server.';
  }

  return error?.message || 'Database connection failed.';
}

function getExpiryDate() {
  return new Date(Date.now() + shareExpiryHours * 60 * 60 * 1000);
}

function getShareTotalSize(share) {
  return share.files.reduce((total, file) => total + file.size, 0);
}

async function removeTempFile(filePath) {
  if (!filePath) {
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to remove temp upload file:', error);
    }
  }
}

async function cleanupTempFiles(files) {
  await Promise.all((files || []).map((file) => removeTempFile(file.path)));
}

async function deleteStoredFile(storageId) {
  if (!storageId || !ObjectId.isValid(storageId)) {
    return;
  }

  const currentBucket = await connectToDatabase();

  try {
    await currentBucket.delete(new ObjectId(storageId));
  } catch (error) {
    if (error.code !== 26) {
      throw error;
    }
  }
}

async function removeShare(share) {
  for (const file of share.files) {
    await deleteStoredFile(file.storageId);
  }

  await Share.deleteOne({ _id: share._id });
}

async function cleanupExpiredShares() {
  const currentBucket = await connectToDatabase();
  const expiredStoredFiles = await currentBucket
    .find({ 'metadata.expiresAt': { $lte: new Date() } })
    .toArray();

  for (const storedFile of expiredStoredFiles) {
    try {
      await currentBucket.delete(storedFile._id);
    } catch (error) {
      if (error.code !== 26) {
        console.error('Failed to clean up expired stored file:', error);
      }
    }
  }

  const expiredShares = await Share.find({ expiresAt: { $lte: new Date() } }).select('_id files');

  for (const expiredShare of expiredShares) {
    try {
      await removeShare(expiredShare);
    } catch (error) {
      console.error('Failed to clean up expired share:', error);
    }
  }
}

function scheduleCleanupExpiredShares() {
  const now = Date.now();
  const minimumIntervalMs = 10 * 60 * 1000;

  if (cleanupPromise || now - lastCleanupStartedAt < minimumIntervalMs) {
    return;
  }

  lastCleanupStartedAt = now;
  cleanupPromise = cleanupExpiredShares()
    .catch((error) => {
      console.error('Background share cleanup failed:', error);
    })
    .finally(() => {
      cleanupPromise = null;
    });
}

async function getShareByPin(pin) {
  await connectToDatabase();
  scheduleCleanupExpiredShares();

  const share = await Share.findOne({ pin });
  if (!share) {
    return null;
  }

  if (share.expiresAt <= new Date()) {
    await removeShare(share);
    return null;
  }

  return share;
}

function formatShareResponse(share) {
  return {
    success: true,
    pin: share.pin,
    files: share.files.map((file) => ({
      filename: file.originalName,
      size: file.size,
      mimetype: file.mimetype
    })),
    totalSize: getShareTotalSize(share),
    fileCount: share.files.length,
    remainingDownloads: share.remainingDownloads,
    totalDownloadsAllowed: share.totalDownloadsAllowed,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt
  };
}

function formatAdminShareResponse(share) {
  return {
    id: share._id.toString(),
    pin: share.pin,
    files: share.files.map((file) => ({
      storageId: file.storageId,
      filename: file.originalName,
      mimetype: file.mimetype,
      size: file.size
    })),
    totalSize: getShareTotalSize(share),
    fileCount: share.files.length,
    remainingDownloads: share.remainingDownloads,
    totalDownloadsAllowed: share.totalDownloadsAllowed,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt
  };
}

function createAdminSession() {
  const token = crypto.randomBytes(24).toString('hex');
  adminSessions.set(token, {
    expiresAt: Date.now() + adminSessionHours * 60 * 60 * 1000
  });

  return token;
}

function getAdminToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  return '';
}

function requireAdminAuth(req, res, next) {
  const token = getAdminToken(req);
  const session = adminSessions.get(token);

  if (!session) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return res.status(401).json({ error: 'Admin session expired' });
  }

  return next();
}

app.post(
  '/api/upload',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 15,
    message: 'Too many upload attempts. Please try again later.'
  }),
  (req, res) => {
    uploadMany(req, res, async (error) => {
      if (error?.code === 'LIMIT_FILE_SIZE') {
        await cleanupTempFiles(req.files);
        return res.status(400).json({ error: `Total upload size must be less than ${maxTotalUploadMb}MB` });
      }

      if (error?.code === 'LIMIT_FILE_COUNT') {
        await cleanupTempFiles(req.files);
        return res.status(400).json({ error: `You can upload up to ${maxFilesPerShare} files at a time` });
      }

      if (error) {
        await cleanupTempFiles(req.files);
        console.error('Upload middleware error:', error);
        return res.status(400).json({ error: error.message || 'Failed to upload files' });
      }

      try {
        await connectToDatabase();
        scheduleCleanupExpiredShares();

        const files = req.files || [];
        if (files.length === 0) {
          await cleanupTempFiles(files);
          return res.status(400).json({ error: 'No files uploaded' });
        }

        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        if (totalSize > maxTotalUploadBytes) {
          await cleanupTempFiles(files);
          return res.status(400).json({ error: `Total upload size must be less than ${maxTotalUploadMb}MB` });
        }

        let pin;
        let pinExists = true;
        while (pinExists) {
          pin = generatePin();
          const existingShare = await Share.findOne({ pin });
          if (!existingShare) {
            pinExists = false;
          }
        }

        const currentBucket = await connectToDatabase();
        const uploadedFiles = [];

        for (const file of files) {
          const uploadStream = currentBucket.openUploadStream(file.originalname, {
            contentType: file.mimetype,
            metadata: {
              sharePin: pin,
              expiresAt: getExpiryDate()
            }
          });

          await new Promise((resolve, reject) => {
            fs.createReadStream(file.path)
              .pipe(uploadStream)
              .on('error', reject)
              .on('finish', resolve);
          });

          uploadedFiles.push({
            storageId: uploadStream.id.toString(),
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size
          });
          file.storageId = uploadStream.id.toString();

          await removeTempFile(file.path);
        }

        const share = new Share({
          pin,
          files: uploadedFiles,
          remainingDownloads: pinDownloadLimit,
          totalDownloadsAllowed: pinDownloadLimit,
          expiresAt: getExpiryDate()
        });

        await share.save();

        return res.json({
          ...formatShareResponse(share),
          maxTotalUploadMb
        });
      } catch (uploadError) {
        const uploadedFiles = req.files || [];
        if (Array.isArray(uploadedFiles)) {
          for (const file of uploadedFiles) {
            if (file?.storageId) {
              await deleteStoredFile(file.storageId);
            }
          }
        }
        await cleanupTempFiles(req.files);
        console.error('Upload error:', uploadError);
        return res.status(500).json({ error: getDatabaseErrorMessage(uploadError) });
      }
    });
  }
);

app.get(
  '/api/file/:pin',
  rateLimit({
    windowMs: 10 * 60 * 1000,
    maxRequests: 60,
    message: 'Too many PIN checks. Please try again later.'
  }),
  async (req, res) => {
    try {
      const share = await getShareByPin(req.params.pin);

      if (!share) {
        return res.status(404).json({ error: 'Files not found or PIN invalid' });
      }

      if (share.remainingDownloads <= 0) {
        await removeShare(share);
        return res.status(410).json({ error: 'This PIN has reached its download limit' });
      }

      return res.json(formatShareResponse(share));
    } catch (error) {
      console.error('File info error:', error);
      return res.status(500).json({ error: getDatabaseErrorMessage(error) });
    }
  }
);

app.get(
  '/api/download/:pin',
  rateLimit({
    windowMs: 10 * 60 * 1000,
    maxRequests: 25,
    message: 'Too many download attempts. Please try again later.'
  }),
  async (req, res) => {
    try {
      const share = await getShareByPin(req.params.pin);

      if (!share) {
        return res.status(404).json({ error: 'Files not found or PIN invalid' });
      }

      if (share.remainingDownloads <= 0) {
        await removeShare(share);
        return res.status(410).json({ error: 'This PIN has reached its download limit' });
      }

      share.remainingDownloads -= 1;
      await share.save();

      const archiveName =
        share.files.length === 1 ? share.files[0].originalName : `sharefiles-${share.pin}.zip`;

      if (share.files.length === 1) {
        const file = share.files[0];
        res.setHeader('Content-Type', file.mimetype);
        res.setHeader('Content-Length', file.size);
        res.setHeader('X-Remaining-Downloads', String(share.remainingDownloads));
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(archiveName)}"`);

        const currentBucket = await connectToDatabase();
        const downloadStream = currentBucket.openDownloadStream(new ObjectId(file.storageId));

        downloadStream.on('error', (error) => {
          console.error('Download stream error:', error);
          if (!res.headersSent) {
            res.status(404).json({ error: 'File not found on server' });
          } else {
            res.end();
          }
        });

        return downloadStream.pipe(res);
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('X-Remaining-Downloads', String(share.remainingDownloads));
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(archiveName)}"`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (error) => {
        throw error;
      });
      archive.pipe(res);

      const currentBucket = await connectToDatabase();
      for (const file of share.files) {
        const stream = currentBucket.openDownloadStream(new ObjectId(file.storageId));
        archive.append(stream, { name: file.originalName });
      }

      return archive.finalize();
    } catch (error) {
      console.error('Download error:', error);
      return res.status(500).json({ error: getDatabaseErrorMessage(error) });
    }
  }
);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    maxTotalUploadMb,
    maxFilesPerShare,
    pinDownloadLimit,
    shareExpiryHours,
    storage: 'mongodb-gridfs',
    databaseConfigured: Boolean(process.env.MONGODB_URI)
  });
});

app.post(
  '/api/admin/login',
  rateLimit({
    windowMs: 10 * 60 * 1000,
    maxRequests: 20,
    message: 'Too many admin login attempts. Please try again later.'
  }),
  (req, res) => {
    const submittedPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (submittedPassword !== adminPassword) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const token = createAdminSession();
    return res.json({
      success: true,
      token,
      expiresInHours: adminSessionHours
    });
  }
);

app.get('/api/admin/shares', requireAdminAuth, async (req, res) => {
  try {
    await connectToDatabase();
    scheduleCleanupExpiredShares();

    const shares = await Share.find({})
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      shares: shares.map(formatAdminShareResponse)
    });
  } catch (error) {
    console.error('Admin shares error:', error);
    return res.status(500).json({ error: getDatabaseErrorMessage(error) });
  }
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  connectToDatabase().catch((error) => {
    console.error('MongoDB connection error:', error);
  });
}

module.exports = app;
