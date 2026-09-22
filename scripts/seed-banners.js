const https = require('https');
const { connectDB } = require('../src/config/db');
const { saveMediaFile } = require('../src/services/mediaService');

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadBuffer(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function run() {
  const db = await connectDB();
  console.log('[Banner Seeder] Connected to Atlas MongoDB');

  const banners = [
    {
      filename: 'hero-banner-lawn-luxury.jpg',
      url: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1600&q=80',
      heading: 'THE ART OF FINE FABRICS'
    },
    {
      filename: 'hero-banner-festive-chiffon.jpg',
      url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1600&q=80',
      heading: 'EXCLUSIVE FESTIVE CHIFFON'
    },
    {
      filename: 'hero-banner-wholesale.jpg',
      url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1600&q=80',
      heading: 'DIRECT FACTORY WHOLESALE'
    }
  ];

  for (const b of banners) {
    try {
      console.log('[Banner Seeder] Fetching visual for:', b.filename);
      const { buffer, contentType } = await downloadBuffer(b.url);
      await saveMediaFile({
        filename: b.filename,
        originalName: b.filename,
        mimetype: contentType || 'image/jpeg',
        buffer,
        size: buffer.length
      });
      console.log('[Banner Seeder] ✓ Saved to Atlas media_uploads:', b.filename, buffer.length, 'bytes');

      const res = await db.collection('hero_slides').updateOne(
        { heading: b.heading },
        { $set: { image: '/uploads/' + b.filename, updatedAt: new Date() } }
      );
      console.log('[Banner Seeder] ✓ Updated hero_slides in DB:', b.heading, 'matched:', res.matchedCount);
    } catch (e) {
      console.error('[Banner Seeder] Error for', b.filename, e.message);
    }
  }

  console.log('[Banner Seeder] Finished.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
