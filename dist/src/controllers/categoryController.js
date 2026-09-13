const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');
const { logAudit } = require('../services/auditService');

const { FALLBACK_CATEGORIES } = require('../data/fallbackCatalog');

async function getCategories(req, res, next) {
  try {
    const db = getDb();
    if (!db) {
      return res.json({
        success: true,
        categories: FALLBACK_CATEGORIES
      });
    }

    const categories = await db.collection('categories')
      .find({ active: { $ne: false } })
      .sort({ sortOrder: 1, name: 1 })
      .toArray();

    res.json({
      success: true,
      categories: categories.length > 0 ? categories : FALLBACK_CATEGORIES
    });
  } catch (err) {
    console.error('getCategories error:', err.message);
    res.json({
      success: true,
      categories: FALLBACK_CATEGORIES
    });
  }
}

async function createCategory(req, res, next) {
  try {
    const { name, description, emoji, sortOrder, isNav } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required.'
      });
    }

    const db = getDb();
    const cleanName = name.trim();

    const existing = await db.collection('categories').findOne({
      name: { $regex: `^${cleanName}$`, $options: 'i' }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A category with this name already exists.'
      });
    }

    const newCat = {
      name: cleanName,
      description: description || '',
      emoji: emoji || '✨',
      sortOrder: Number(sortOrder) || 0,
      isNav: isNav !== undefined ? Boolean(isNav) : true,
      active: true,
      createdAt: new Date()
    };

    const result = await db.collection('categories').insertOne(newCat);
    newCat._id = result.insertedId;

    await logAudit({
      userId: req.user._id,
      username: req.user.username,
      action: 'CREATE_CATEGORY',
      entity: 'categories',
      entityId: result.insertedId,
      details: { name: cleanName }
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      category: newCat
    });
  } catch (err) {
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, emoji, sortOrder, isNav, active } = req.body;
    const db = getDb();

    const updates = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (emoji !== undefined) updates.emoji = emoji;
    if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);
    if (isNav !== undefined) updates.isNav = Boolean(isNav);
    if (active !== undefined) updates.active = Boolean(active);

    await db.collection('categories').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    await logAudit({
      userId: req.user._id,
      username: req.user.username,
      action: 'UPDATE_CATEGORY',
      entity: 'categories',
      entityId: id,
      details: { updates }
    });

    res.json({
      success: true,
      message: 'Category updated successfully.'
    });
  } catch (err) {
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();

    const category = await db.collection('categories').findOne({ _id: new ObjectId(id) });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.'
      });
    }

    // Check if products exist in category
    const productsInCat = await db.collection('products').countDocuments({
      category: category.name,
      isArchived: { $ne: true }
    });

    if (productsInCat > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category '${category.name}' because ${productsInCat} active products belong to it. Please reassign those products first.`
      });
    }

    await db.collection('categories').deleteOne({ _id: new ObjectId(id) });

    await logAudit({
      userId: req.user._id,
      username: req.user.username,
      action: 'DELETE_CATEGORY',
      entity: 'categories',
      entityId: id,
      details: { name: category.name }
    });

    res.json({
      success: true,
      message: 'Category deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
};
