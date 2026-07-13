const mongoose = require('mongoose');

const shareFileSchema = new mongoose.Schema(
  {
    storageId: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    }
  },
  { _id: false }
);

const shareSchema = new mongoose.Schema({
  pin: {
    type: String,
    required: true,
    unique: true
  },
  files: {
    type: [shareFileSchema],
    required: true,
    validate: [(value) => Array.isArray(value) && value.length > 0, 'At least one file is required']
  },
  remainingDownloads: {
    type: Number,
    required: true,
    default: 10,
    min: 0
  },
  totalDownloadsAllowed: {
    type: Number,
    required: true,
    default: 10
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: {
      expires: 0
    }
  }
});

module.exports = mongoose.model('Share', shareSchema);
