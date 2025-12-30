/**
 * File upload middleware configuration
 * Uses multer for handling multipart/form-data
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure uploads directory exists
const uploadsDir = config.paths.uploadsDir;
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

// File filter - only allow zip files
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-zip',
    'application/octet-stream',
  ];

  const allowedExtensions = ['.zip'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .zip files are allowed'), false);
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
  },
});

// Error handling middleware for multer
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 500MB.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  if (err) {
    return res.status(400).json({ error: err.message });
  }

  next();
}

module.exports = {
  upload,
  handleUploadError,
};
