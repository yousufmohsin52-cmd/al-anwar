const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const API_DIR = path.join(ROOT_DIR, 'api');

console.log('====================================================');
console.log('  AL ANWAR FABRICS & CLOTH - Production Build');
console.log('  Target: dist/ for Vercel & Production Hosting');
console.log('====================================================');

// Helper to copy directory recursively
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return 0;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  let count = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

// 1. Clean & recreate dist folder
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. Copy public assets directly into dist root
console.log('[1/4] Copying public assets into dist/...');
const publicCount = copyDirRecursive(PUBLIC_DIR, DIST_DIR);
console.log(`  ✓ Copied ${publicCount} static files from public/`);

// 3. Copy src code into dist/src
console.log('[2/4] Copying backend application files into dist/src/...');
const srcCount = copyDirRecursive(SRC_DIR, path.join(DIST_DIR, 'src'));
console.log(`  ✓ Copied ${srcCount} backend files from src/`);

// 4. Copy api serverless handler into dist/api
if (fs.existsSync(API_DIR)) {
  console.log('[3/4] Copying Vercel serverless handlers into dist/api/...');
  const apiCount = copyDirRecursive(API_DIR, path.join(DIST_DIR, 'api'));
  console.log(`  ✓ Copied ${apiCount} serverless files from api/`);
}

// 5. Copy configuration files (vercel.json, package.json, etc.)
console.log('[4/4] Copying deployment manifests...');
const filesToCopy = ['vercel.json', 'package.json'];
for (const file of filesToCopy) {
  const filePath = path.join(ROOT_DIR, file);
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, path.join(DIST_DIR, file));
    console.log(`  ✓ Copied ${file}`);
  }
}

console.log('====================================================');
console.log('✓ BUILD SUCCESSFUL!');
console.log(`  Output directory: ${DIST_DIR}`);
console.log('  Ready for Vercel deployment with serverless backend & static assets.');
console.log('====================================================');
