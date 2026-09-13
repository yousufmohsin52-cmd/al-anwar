const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');
const { logAudit } = require('../services/auditService');

const { FALLBACK_ANNOUNCEMENTS, FALLBACK_HERO_SLIDES } = require('../data/fallbackCatalog');

async function getPublicCMS(req, res, next) {
  try {
    const db = getDb();
    if (!db) {
      return res.json({
        success: true,
        announcements: FALLBACK_ANNOUNCEMENTS,
        heroSlides: FALLBACK_HERO_SLIDES,
        storeSettings: {
          name: 'AL ANWAR FABRICS & CLOTH',
          address: 'M.A. Jinnah Road, Iqbal Cloth Market, Shop # M101/1, Karachi, Pakistan',
          phone: '03363925950',
          whatsapp: '+923363925950',
          email: 'info@alanwarcloth.com',
          freeDeliveryThreshold: 5000,
          currency: 'PKR',
          currencySymbol: 'Rs.'
        },
        homepageSections: {
          heroHeadline: 'THE ART OF FINE FABRICS',
          heroSubheading: 'Exquisite Pakistani unstitched lawn, festive chiffon, and luxury cotton collections direct from Karachi wholesale market.',
          banner1Badge: 'NEW FESTIVE 2026',
          banner1Title: 'LUXURY UNSTITCHED SUITS',
          banner1Subtitle: 'Handpicked Embroidered & Digital Lawn 3-Piece',
          banner2Badge: 'WHOLESALE BUNDLES',
          banner2Title: 'DIRECT MILLS WHOLESALE',
          banner2Subtitle: 'Shopkeepers & Boutiques welcome across Pakistan'
        }
      });
    }

    // 1. Announcements
    const announcements = await db.collection('announcements')
      .find({ active: true })
      .sort({ sortOrder: 1 })
      .toArray();

    // 2. Hero Slides
    const heroSlides = await db.collection('hero_slides')
      .find({ active: true })
      .sort({ sortOrder: 1 })
      .toArray();

    // 3. Store Settings
    const settingsDoc = await db.collection('settings').findOne({ key: 'store_settings' });

    // 4. Featured Collections / Sections
    const sectionsDoc = await db.collection('settings').findOne({ key: 'homepage_sections' });

    res.json({
      success: true,
      announcements: announcements.length > 0 ? announcements.map(a => a.text) : FALLBACK_ANNOUNCEMENTS,
      heroSlides: heroSlides.length > 0 ? heroSlides : FALLBACK_HERO_SLIDES,
      storeSettings: settingsDoc ? settingsDoc.value : {
        name: 'AL ANWAR FABRICS & CLOTH',
        address: 'M.A. Jinnah Road, Iqbal Cloth Market, Shop # M101/1, Karachi, Pakistan',
        phone: '03363925950',
        whatsapp: '+923363925950',
        email: 'info@alanwarcloth.com',
        freeDeliveryThreshold: 5000,
        currency: 'PKR',
        currencySymbol: 'Rs.'
      },
      homepageSections: sectionsDoc ? sectionsDoc.value : {
        heroHeadline: 'THE ART OF FINE FABRICS',
        heroSubheading: 'Exquisite Pakistani unstitched lawn, festive chiffon, and luxury cotton collections direct from Karachi wholesale market.',
        banner1Badge: 'NEW FESTIVE 2026',
        banner1Title: 'LUXURY UNSTITCHED SUITS',
        banner1Subtitle: 'Handpicked Embroidered & Digital Lawn 3-Piece',
        banner2Badge: 'WHOLESALE BUNDLES',
        banner2Title: 'DIRECT MILLS WHOLESALE',
        banner2Subtitle: 'Shopkeepers & Boutiques welcome across Pakistan'
      }
    });
  } catch (err) {
    console.error('getPublicCMS error:', err.message);
    res.json({
      success: true,
      announcements: FALLBACK_ANNOUNCEMENTS,
      heroSlides: FALLBACK_HERO_SLIDES,
      storeSettings: {
        name: 'AL ANWAR FABRICS & CLOTH',
        address: 'M.A. Jinnah Road, Iqbal Cloth Market, Shop # M101/1, Karachi, Pakistan',
        phone: '03363925950',
        whatsapp: '+923363925950',
        email: 'info@alanwarcloth.com',
        freeDeliveryThreshold: 5000,
        currency: 'PKR',
        currencySymbol: 'Rs.'
      }
    });
  }
}

// Announcements CRUD
async function getAnnouncements(req, res, next) {
  try {
    const db = getDb();
    const announcements = await db.collection('announcements').find().sort({ sortOrder: 1 }).toArray();
    res.json({ success: true, announcements });
  } catch (err) {
    next(err);
  }
}

async function updateAnnouncements(req, res, next) {
  try {
    const { items } = req.body; // array of { text, active, sortOrder }
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Items array is required.' });
    }

    const db = getDb();
    await db.collection('announcements').deleteMany({});

    const docs = items.map((item, idx) => ({
      text: typeof item === 'string' ? item : item.text,
      active: item.active !== undefined ? Boolean(item.active) : true,
      sortOrder: item.sortOrder !== undefined ? Number(item.sortOrder) : idx,
      updatedAt: new Date()
    }));

    if (docs.length > 0) {
      await db.collection('announcements').insertMany(docs);
    }

    await logAudit({
      userId: req.user._id,
      username: req.user.username,
      action: 'UPDATE_ANNOUNCEMENTS',
      entity: 'announcements',
      details: { count: docs.length }
    });

    res.json({ success: true, message: 'Announcements updated successfully.' });
  } catch (err) {
    next(err);
  }
}

// Hero Slides CRUD
async function getHeroSlides(req, res, next) {
  try {
    const db = getDb();
    const slides = await db.collection('hero_slides').find().sort({ sortOrder: 1 }).toArray();
    res.json({ success: true, slides });
  } catch (err) {
    next(err);
  }
}

async function createHeroSlide(req, res, next) {
  try {
    const { heading, subheading, buttonText, buttonUrl, image, active, sortOrder, badge } = req.body;
    const db = getDb();

    const slideDoc = {
      heading: heading || 'THE ART OF FINE FABRICS',
      subheading: subheading || 'Premium fabrics for every occasion.',
      buttonText: buttonText || 'SHOP COLLECTION',
      buttonUrl: buttonUrl || '#collection',
      badge: badge || 'EXCLUSIVE 2026',
      image: image || (req.file ? `/uploads/${req.file.filename}` : ''),
      active: active !== undefined ? Boolean(active) : true,
      sortOrder: Number(sortOrder) || 0,
      createdAt: new Date()
    };

    const result = await db.collection('hero_slides').insertOne(slideDoc);
    slideDoc._id = result.insertedId;

    await logAudit({
      userId: req.user._id,
      username: req.user.username,
      action: 'CREATE_HERO_SLIDE',
      entity: 'hero_slides',
      entityId: result.insertedId,
      details: { heading: slideDoc.heading }
    });

    res.status(201).json({ success: true, message: 'Hero slide created.', slide: slideDoc });
  } catch (err) {
    next(err);
  }
}

async function updateHeroSlide(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();

    const updates = { updatedAt: new Date() };
    const fields = ['heading', 'subheading', 'buttonText', 'buttonUrl', 'image', 'active', 'sortOrder', 'badge'];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        if (f === 'active') updates[f] = Boolean(req.body[f]);
        else if (f === 'sortOrder') updates[f] = Number(req.body[f]);
        else updates[f] = req.body[f];
      }
    });

    if (req.file) {
      updates.image = `/uploads/${req.file.filename}`;
    }

    await db.collection('hero_slides').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    res.json({ success: true, message: 'Hero slide updated.' });
  } catch (err) {
    next(err);
  }
}

async function deleteHeroSlide(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();
    await db.collection('hero_slides').deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true, message: 'Hero slide deleted.' });
  } catch (err) {
    next(err);
  }
}

// Store Settings & Homepage sections
async function updateStoreSettings(req, res, next) {
  try {
    const { storeSettings, homepageSections } = req.body;
    const db = getDb();

    if (storeSettings) {
      await db.collection('settings').updateOne(
        { key: 'store_settings' },
        { $set: { key: 'store_settings', value: storeSettings, updatedAt: new Date() } },
        { upsert: true }
      );
    }

    if (homepageSections) {
      await db.collection('settings').updateOne(
        { key: 'homepage_sections' },
        { $set: { key: 'homepage_sections', value: homepageSections, updatedAt: new Date() } },
        { upsert: true }
      );
    }

    await logAudit({
      userId: req.user._id,
      username: req.user.username,
      action: 'UPDATE_SETTINGS',
      entity: 'settings',
      details: { updatedKeys: Object.keys(req.body) }
    });

    res.json({ success: true, message: 'Website settings saved successfully.' });
  } catch (err) {
    next(err);
  }
}

async function getAuditLogs(req, res, next) {
  try {
    const db = getDb();
    const { limit = 100, page = 1 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const total = await db.collection('audit_logs').countDocuments();
    const logs = await db.collection('audit_logs')
      .find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    res.json({
      success: true,
      total,
      logs
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPublicCMS,
  getAnnouncements,
  updateAnnouncements,
  getHeroSlides,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
  updateStoreSettings,
  getAuditLogs
};
