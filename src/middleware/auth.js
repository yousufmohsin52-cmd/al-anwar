const jwt = require('jsonwebtoken');
const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');

const JWT_SECRET = process.env.JWT_SECRET || 'al_anwar_jwt_secret_default_2026';

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    const user = await db.collection('users').findOne({
      _id: new ObjectId(decoded.id),
      active: { $ne: false }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User session is invalid or user account has been disabled.'
      });
    }

    // Attach user to request without password hash
    const { password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session has expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token.'
    });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access.'
      });
    }

    // Super Admin / Owner always has full access
    if (req.user.role === 'super_admin' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Your role '${req.user.role}' is not authorized for this operation.`
    });
  };
}

module.exports = {
  authenticate,
  authorize
};
