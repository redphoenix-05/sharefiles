const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { GridFSBucket, ObjectId } = require('mongodb');
const { Readable } = require('stream');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const File = require('./models/File');

const app = express();
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB || (isVercel ? 4 : 50));
const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;
let connectionPromise;
let bucket;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSizeBytes
  }
});
const uploadSingle = upload.single('file');

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
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

async function deleteStoredFile(file) {
  if (!file?.storageId || !ObjectId.isValid(file.storageId)) {
    return;
  }

  const currentBucket = await connectToDatabase();

  try {
    await currentBucket.delete(new ObjectId(file.storageId));
  } catch (error) {
    if (error.code !== 26) {
      throw error;
    }
  }
}

async function removeFileRecord(file) {
  await deleteStoredFile(file);
  await File.deleteOne({ _id: file._id });
}

async function cleanupExpiredFiles() {
  const expiredFiles = await File.find({ expiresAt: { $lte: new Date() } }).select('_id storageId');

  for (const expiredFile of expiredFiles) {
    try {
      await removeFileRecord(expiredFile);
    } catch (error) {
      console.error('Failed to clean up expired file:', error);
    }
  }
}

app.post('/api/upload', (req, res) => {
  uploadSingle(req, res, async (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `File size must be less than ${maxFileSizeMb}MB`
      });
    }

    if (error) {
      console.error('Upload middleware error:', error);
      return res.status(500).json({ error: 'Failed to upload file' });
    }

    try {
      await connectToDatabase();
      await cleanupExpiredFiles();

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      let pin;
      let pinExists = true;

      while (pinExists) {
        pin = generatePin();
        const existingFile = await File.findOne({ pin });
        if (!existingFile) {
          pinExists = false;
        }
      }

      const currentBucket = await connectToDatabase();
      const uploadStream = currentBucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype
      });

      await new Promise((resolve, reject) => {
        Readable.from(req.file.buffer)
          .pipe(uploadStream)
          .on('error', reject)
          .on('finish', resolve);
      });

      const fileData = new File({
        storageId: uploadStream.id.toString(),
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        pin,
        expiresAt: getExpiryDate()
      });

      await fileData.save();

      return res.json({
        success: true,
        pin,
        filename: req.file.originalname,
        size: req.file.size,
        maxFileSizeMb
      });
    } catch (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({ error: getDatabaseErrorMessage(uploadError) });
    }
  });
});

app.get('/api/file/:pin', async (req, res) => {
  try {
    await connectToDatabase();
    await cleanupExpiredFiles();

    const { pin } = req.params;
    const file = await File.findOne({ pin });

    if (!file) {
      return res.status(404).json({ error: 'File not found or PIN invalid' });
    }

    if (file.expiresAt <= new Date()) {
      await removeFileRecord(file);
      return res.status(404).json({ error: 'File has expired' });
    }

    return res.json({
      success: true,
      filename: file.originalName,
      size: file.size,
      mimetype: file.mimetype,
      createdAt: file.createdAt
    });
  } catch (error) {
    console.error('File info error:', error);
    return res.status(500).json({ error: getDatabaseErrorMessage(error) });
  }
});

app.get('/api/download/:pin', async (req, res) => {
  try {
    const currentBucket = await connectToDatabase();
    await cleanupExpiredFiles();

    const { pin } = req.params;
    const file = await File.findOne({ pin });

    if (!file) {
      return res.status(404).json({ error: 'File not found or PIN invalid' });
    }

    if (file.expiresAt <= new Date()) {
      await removeFileRecord(file);
      return res.status(404).json({ error: 'File has expired' });
    }

    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Length', file.size);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.originalName)}"`
    );

    const downloadStream = currentBucket.openDownloadStream(new ObjectId(file.storageId));

    downloadStream.on('error', (error) => {
      console.error('Download stream error:', error);
      if (!res.headersSent) {
        res.status(404).json({ error: 'File not found on server' });
      } else {
        res.end();
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({ error: getDatabaseErrorMessage(error) });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    maxFileSizeMb,
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
