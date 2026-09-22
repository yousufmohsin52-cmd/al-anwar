const path = require('path');
const fs = require('fs');
const { getDb } = require('../config/db');

const localUploadDir = path.join(__dirname, '../../public/uploads');

// Ensure local upload directory exists if filesystem is writable
try {
  if (!fs.existsSync(localUploadDir)) {
    fs.mkdirSync(localUploadDir, { recursive: true });
  }
} catch (e) {
  // Read-only filesystem in serverless environments
}

/**
 * Persist an uploaded file buffer into MongoDB Atlas media_uploads collection
 * and write to local disk as cache when permitted.
 */
async function saveMediaFile({ filename, originalName, mimetype, buffer, size }) {
  // 1. Save to MongoDB Atlas collection for permanent serverless resilience
  try {
    const db = getDb();
    if (db) {
      await db.collection('media_uploads').updateOne(
        { filename },
        {
          $set: {
            filename,
            originalName: originalName || filename,
            contentType: mimetype || 'image/jpeg',
            size: size || (buffer ? buffer.length : 0),
            data: buffer,
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
    }
  } catch (dbErr) {
    console.warn('[MediaService] MongoDB Atlas media upload save warning:', dbErr.message);
  }

  // 2. Also cache to local disk if writable
  try {
    const localFilePath = path.join(localUploadDir, filename);
    fs.writeFileSync(localFilePath, buffer);
  } catch (fsErr) {
    // Expected on serverless environments like Vercel read-only filesystem
  }

  return `/uploads/${filename}`;
}

/**
 * Retrieve a media file by filename from local disk or MongoDB Atlas
 */
async function getMediaFile(filename) {
  const cleanFilename = path.basename(filename);

  // 1. Try local disk cache first
  try {
    const localPath = path.join(localUploadDir, cleanFilename);
    if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
      const buffer = fs.readFileSync(localPath);
      const ext = path.extname(cleanFilename).toLowerCase();
      let contentType = 'image/jpeg';
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.svg') contentType = 'image/svg+xml';
      return { contentType, data: buffer, source: 'disk' };
    }
  } catch (diskErr) {
    // Proceed to database lookup
  }

  // 2. Try MongoDB Atlas collection
  try {
    const db = getDb();
    if (db) {
      const doc = await db.collection('media_uploads').findOne({ filename: cleanFilename });
      if (doc && doc.data) {
        const buffer = doc.data.buffer || doc.data;
        // Also save to local disk cache if writable for subsequent fast hits
        try {
          const localPath = path.join(localUploadDir, cleanFilename);
          fs.writeFileSync(localPath, buffer);
        } catch (e) {}

        return {
          contentType: doc.contentType || 'image/jpeg',
          data: buffer,
          source: 'mongodb'
        };
      }
    }
  } catch (dbErr) {
    console.warn('[MediaService] MongoDB Atlas media lookup warning:', dbErr.message);
  }

  return null;
}

module.exports = {
  saveMediaFile,
  getMediaFile,
  localUploadDir
};
