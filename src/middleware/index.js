/**
 * Middleware module exports
 */

const { authenticateUser, optionalAuth, supabase } = require('./auth');
const { upload, handleUploadError } = require('./upload');

module.exports = {
  authenticateUser,
  optionalAuth,
  supabase,
  upload,
  handleUploadError,
};
