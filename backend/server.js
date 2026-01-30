const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const File = require('./models/File');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Generate 4-digit PIN
function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sharefiles')
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes

// Upload file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate unique PIN
    let pin;
    let pinExists = true;
    
    while (pinExists) {
      pin = generatePin();
      const existingFile = await File.findOne({ pin });
      if (!existingFile) {
        pinExists = false;
      }
    }

    // Save file info to database
    const fileData = new File({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      pin: pin,
      path: req.file.path
    });

    await fileData.save();

    res.json({
      success: true,
      pin: pin,
      filename: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get file info by PIN
app.get('/api/file/:pin', async (req, res) => {
  try {
    const { pin } = req.params;
    
    const file = await File.findOne({ pin });
    
    if (!file) {
      return res.status(404).json({ error: 'File not found or PIN invalid' });
    }

    res.json({
      success: true,
      filename: file.originalName,
      size: file.size,
      mimetype: file.mimetype,
      createdAt: file.createdAt
    });
  } catch (error) {
    console.error('File info error:', error);
    res.status(500).json({ error: 'Failed to retrieve file info' });
  }
});

// Download file by PIN
app.get('/api/download/:pin', async (req, res) => {
  try {
    const { pin } = req.params;
    
    const file = await File.findOne({ pin });
    
    if (!file) {
      return res.status(404).json({ error: 'File not found or PIN invalid' });
    }

    // Check if file exists on disk
    if (!fs.existsSync(file.path)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    res.download(file.path, file.originalName);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
