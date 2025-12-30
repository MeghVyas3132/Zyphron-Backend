/**
 * Authentication middleware
 * Verifies JWT tokens using Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

// Initialize Supabase client
const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey
);

/**
 * Middleware to verify JWT token from Authorization header
 * Attaches user info to req.user on success
 */
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional authentication - doesn't fail if no token provided
 * Useful for endpoints that work with or without authentication
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    req.user = error || !user ? null : { id: user.id, email: user.email };
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

// Export supabase client for use in other modules
module.exports = {
  authenticateUser,
  optionalAuth,
  supabase,
};
