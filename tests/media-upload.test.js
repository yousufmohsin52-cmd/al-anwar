const assert = require('assert');
const http = require('http');
const { app, startServer } = require('../src/server');
const { getMediaFile } = require('../src/services/mediaService');
const { connectDB } = require('../src/config/db');

async function runTests() {
  console.log('[Media Test] Starting verification...');
  await connectDB();

  // Test 1: getMediaFile finds existing seeded banner
  console.log('[Test 1] Testing getMediaFile for hero-banner-lawn-luxury.jpg');
  const media = await getMediaFile('hero-banner-lawn-luxury.jpg');
  assert(media !== null, 'Media should be found');
  assert(media.contentType.includes('image'), 'Content type should be image');
  assert(media.data && media.data.length > 1000, 'Buffer should have content');
  console.log('  ✓ getMediaFile passed. Source:', media.source, 'Bytes:', media.data.length);

  // Test 2: Start server on random port and test HTTP GET /uploads/:filename
  const testServer = http.createServer(app);
  await new Promise(resolve => testServer.listen(0, resolve));
  const port = testServer.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log('[Test 2] Server listening on test port:', port);

  // 2a. Existing media request
  await new Promise((resolve, reject) => {
    http.get(`${baseUrl}/uploads/hero-banner-lawn-luxury.jpg`, (res) => {
      assert.strictEqual(res.statusCode, 200);
      assert(res.headers['content-type'].includes('image'), 'Should return image content type');
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        assert(body.length > 1000, 'Image should have body');
        console.log('  ✓ HTTP GET /uploads/hero-banner-lawn-luxury.jpg returned 200 OK with', body.length, 'bytes');
        resolve();
      });
    }).on('error', reject);
  });

  // 2b. Missing media request should return SVG placeholder gracefully, NOT 404 or HTML
  await new Promise((resolve, reject) => {
    http.get(`${baseUrl}/uploads/totally-random-missing-file.jpg`, (res) => {
      assert.strictEqual(res.statusCode, 200);
      assert(res.headers['content-type'].includes('image/svg+xml'), 'Should be svg content type');
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        assert(body.includes('<svg'), 'Should return SVG placeholder');
        console.log('  ✓ HTTP GET /uploads/missing.jpg gracefully returned SVG placeholder (No broken 404!)');
        resolve();
      });
    }).on('error', reject);
  });

  // 2c. Check /api/cms/public returns the updated hero slides with images
  await new Promise((resolve, reject) => {
    http.get(`${baseUrl}/api/cms/public`, (res) => {
      assert.strictEqual(res.statusCode, 200);
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const json = JSON.parse(data);
        assert(json.success, 'CMS public should succeed');
        assert(json.heroSlides && json.heroSlides.length > 0, 'Should have hero slides');
        const firstSlide = json.heroSlides.find(s => s.heading === 'THE ART OF FINE FABRICS');
        assert(firstSlide, 'Should find THE ART OF FINE FABRICS slide');
        assert(firstSlide.image && firstSlide.image.startsWith('/uploads/'), 'Slide image should be set to /uploads/...');
        console.log('  ✓ /api/cms/public returns active hero slide with image:', firstSlide.image);
        resolve();
      });
    }).on('error', reject);
  });

  testServer.close();
  console.log('\n[ALL TESTS PASSED SUCCESSFULLY!]\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
