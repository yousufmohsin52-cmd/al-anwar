const { app } = require('../src/server');

// Export Express app directly for Vercel Serverless Function runtime
module.exports = app;
