function errorHandler(err, req, res, next) {
  console.error('[Error Occurred]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle Multer upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size exceeds maximum allowed limit (5MB).'
    });
  }

  // Handle duplicate key error in MongoDB
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      message: `A record with this ${field} already exists.`
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.isOperational
    ? err.message
    : (process.env.NODE_ENV === 'production' ? 'Internal server error. Please contact technical support.' : err.message);

  res.status(statusCode).json({
    success: false,
    message
  });
}

module.exports = errorHandler;
