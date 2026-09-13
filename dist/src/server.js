const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectDB } = require('./config/db');
const apiRouter = require('./routes/api');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & CORS middleware
if (!process.env.VERCEL) {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
}

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting on login (standalone server only)
if (!process.env.VERCEL) {
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' }
  });
  app.use('/api/auth/login', loginLimiter);
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure database connection for incoming requests (Vercel Serverless & Local)
let isDbConnected = false;
app.use(async (req, res, next) => {
  if (!isDbConnected) {
    try {
      await connectDB();
      isDbConnected = true;
    } catch (err) {
      console.error('[MongoDB Atlas Connection Notice]:', err.message);
    }
  }
  next();
});

// Static frontend files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Mount API routes
app.use('/api', apiRouter);

// Frontend SPA routing helpers
app.get('/admin', (req, res) => {
  const adminPath = path.join(__dirname, '../public/admin.html');
  if (fs.existsSync(adminPath)) {
    return res.sendFile(adminPath);
  }
  res.redirect('/admin.html');
});

app.use((req, res) => {
  // If request begins with /api, return 404 JSON
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found.' });
  }
  const indexPath = path.join(__dirname, '../public/index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).send('Not Found');
});

// Error handling middleware
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`  AL ANWAR FABRICS & CLOTH - Enterprise Server`);
      console.log(`  Storefront: http://localhost:${PORT}`);
      console.log(`  Admin ERP:  http://localhost:${PORT}/admin`);
      console.log(`  Shop:       M.A. Jinnah Road, Shop # M101/1, Karachi`);
      console.log(`  WhatsApp:   03363925950 (+923363925950)`);
      console.log(`====================================================`);
    });
    return server;
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
