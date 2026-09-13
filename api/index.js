const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');

let isConnected = false;

module.exports = async (req, res) => {
  // Ensure database is connected before handling serverless request
  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
    } catch (err) {
      console.error('[Vercel Serverless] MongoDB Atlas connection error:', err);
    }
  }

  return app(req, res);
};
