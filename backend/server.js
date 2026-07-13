const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const helmet = require('helmet');
const path = require('path');
const archiver = require('archiver');
const { GridFSBucket, ObjectId } = require('mongodb');
const { Readable } = require('stream');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Share = require('./models/Share');

const app = express();
const maxTotalUploadMb = Number(process.env.MAX_TOTAL_UPLOAD_MB || process.env.MAX_FILE_SIZE_MB || 150);
const maxTotalUploadBytes = maxTotalUploadMb * 1024 * 1024;
const maxFilesPerShare = Number(process.env.MAX_FILES_PER_SHARE || 10);
const pinDownloadLimit = Number(process.env.PIN_DOWNLOAD_LIMIT || 10);
const shareExpiryHours = Number(process.env.SHARE_EXPIRY_HOURS || 2);
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
  storage: multer.memoryStorage(),
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
  const expiredShares = await Share.find({ expiresAt: { $lte: new Date() } }).select('_id files');

  for (const expiredShare of expiredShares) {
    try {
      await removeShare(expiredShare);
    } catch (error) {
      console.error('Failed to clean up expired share:', error);
    }
  }
}

async function getShareByPin(pin) {
  await connectToDatabase();
  await cleanupExpiredShares();

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
        return res.status(400).json({ error: `Total upload size must be less than ${maxTotalUploadMb}MB` });
      }

      if (error?.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: `You can upload up to ${maxFilesPerShare} files at a time` });
      }

      if (error) {
        console.error('Upload middleware error:', error);
        return res.status(400).json({ error: error.message || 'Failed to upload files' });
      }

      try {
        await connectToDatabase();
        await cleanupExpiredShares();

        const files = req.files || [];
        if (files.length === 0) {
          return res.status(400).json({ error: 'No files uploaded' });
        }

        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        if (totalSize > maxTotalUploadBytes) {
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
            contentType: file.mimetype
          });

          await new Promise((resolve, reject) => {
            Readable.from(file.buffer)
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
