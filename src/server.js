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

// Media serving with MongoDB Atlas & disk cache fallback
const { getMediaFile } = require('./services/mediaService');

function getPlaceholderImageSvg(label = 'AL ANWAR FABRICS') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#142119" />
      <stop offset="100%" stop-color="#0a120e" />
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#dfb76c" />
      <stop offset="100%" stop-color="#9a7b38" />
    </linearGradient>
  </defs>
  <rect width="600" height="400" fill="url(#bg)" />
  <rect x="20" y="20" width="560" height="360" fill="none" stroke="url(#gold)" stroke-width="1.5" stroke-dasharray="6,6" rx="8" />
  <circle cx="300" cy="170" r="44" fill="rgba(223,183,108,0.12)" stroke="url(#gold)" stroke-width="1.5" />
  <text x="300" y="180" font-family="Georgia, serif" font-size="28" fill="#dfb76c" text-anchor="middle">👗</text>
  <text x="300" y="245" font-family="sans-serif" font-weight="600" font-size="16" fill="#f5eedc" letter-spacing="3" text-anchor="middle">${label}</text>
  <text x="300" y="270" font-family="sans-serif" font-size="12" fill="#dfb76c" letter-spacing="1.5" text-anchor="middle">LUXURY PAKISTANI TEXTILES</text>
</svg>`;
}

app.get('/uploads/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const media = await getMediaFile(filename);

    if (media && media.data) {
      res.setHeader('Content-Type', media.contentType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      return res.end(media.data);
    }

    // Graceful fallback for lost or missing historic files
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(getPlaceholderImageSvg('AL ANWAR CLOTH'));
  } catch (err) {
    console.error('Error serving upload:', err.message);
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(getPlaceholderImageSvg('IMAGE UNAVAILABLE'));
  }
});

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
  // Never serve HTML for media requests
  if (req.path.startsWith('/uploads')) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(404).send(getPlaceholderImageSvg('NOT FOUND'));
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
