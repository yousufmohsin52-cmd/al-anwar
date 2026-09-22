const multer = require('multer');
const path = require('path');
const { saveMediaFile } = require('../services/mediaService');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|webp|gif|svg/;
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const mimetype = /image\/(jpeg|jpg|png|webp|gif|svg\+xml)/.test(file.mimetype);

  if (extname || mimetype) {
    return cb(null, true);
  }
  cb(new Error('Only image files (JPEG, PNG, WEBP, GIF, SVG) are allowed for upload.'));
};

const multerInstance = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter
});

/**
 * Middleware wrapper that executes multer and automatically persists the file
 * into MongoDB Atlas and local disk via mediaService.
 */
function wrapSingle(fieldName) {
  const handler = multerInstance.single(fieldName);
  return (req, res, next) => {
    handler(req, res, async (err) => {
      if (err) return next(err);
      if (req.file) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const cleanOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        req.file.filename = `${uniqueSuffix}-${cleanOriginalName}`;
        req.file.path = `/uploads/${req.file.filename}`;

        try {
          await saveMediaFile({
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            buffer: req.file.buffer,
            size: req.file.size
          });
        } catch (saveErr) {
          console.warn('[Upload Middleware] Error saving media file to Atlas:', saveErr.message);
        }
      }
      next();
    });
  };
}

const upload = {
  single: wrapSingle,
  array: multerInstance.array.bind(multerInstance),
  fields: multerInstance.fields.bind(multerInstance),
  none: multerInstance.none.bind(multerInstance),
  any: multerInstance.any.bind(multerInstance)
};

module.exports = upload;
