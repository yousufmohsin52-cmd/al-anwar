const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');
const { recordMovement } = require('../services/inventoryService');
const { logAudit } = require('../services/auditService');
const { MOVEMENT_TYPES } = require('../config/constants');

async function getPublicProducts(req, res, next) {
  try {
    const db = getDb();
    const { category, search, fabricType, sort, limit = 50, page = 1 } = req.query;

    const query = {
      active: true,
      isArchived: { $ne: true }
    };

    if (category && category !== 'All' && category !== 'all') {
      query.category = category;
    }

    if (fabricType && fabricType !== 'All') {
      query.fabricType = fabricType;
    }

    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { sku: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { fabricType: { $regex: search.trim(), $options: 'i' } },
        { color: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { retailPrice: 1 };
    if (sort === 'price_desc') sortOption = { retailPrice: -1 };
    if (sort === 'name_asc') sortOption = { name: 1 };

    const skip = (Number(page) - 1) * Number(limit);
    const total = await db.collection('products').countDocuments(query);
    const products = await db.collection('products')
      .find(query, {
        projection: {
          costPrice: 0 // Hide cost price from public customers
        }
      })
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    res.json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      products
    });
  } catch (err) {
    next(err);
  }
}

async function getProductById(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();

    let query = {};
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { sku: id };
    }

    const product = await db.collection('products').findOne(query);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    // Strip costPrice if not authenticated admin
    if (!req.user || (req.user.role !== 'super_admin' && req.user.role !== 'accountant' && req.user.role !== 'inventory_manager')) {
      delete product.costPrice;
    }

    res.json({
      success: true,
      product
    });
  } catch (err) {
    next(err);
  }
}

async function getAdminProducts(req, res, next) {
  try {
    const db = getDb();
    const { category, search, stockStatus, includeArchived } = req.query;

    const query = {};
    if (includeArchived !== 'true') {
      query.isArchived = { $ne: true };
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    if (stockStatus && stockStatus !== 'All') {
      query.stockStatus = stockStatus;
    }

    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { sku: { $regex: search.trim(), $options: 'i' } },
        { fabricType: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const products = await db.collection('products')
      .find(query)
      .sort({ updatedAt: -1 })
      .toArray();

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (err) {
    next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const {
      name,
      sku,
      category,
      fabricType,
      color,
      description,
      costPrice,
      retailPrice,
      wholesalePrice,
      salePrice,
      isOnSale,
      stock = 0,
      lowStockThreshold = 5,
      badges = [],
      emojiIcon = '👗',
      images = [],
      featured = false,
      active = true
    } = req.body;

    if (!name || !sku || !category || retailPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, SKU, category and retail price are required fields.'
      });
    }

    const db = getDb();
    const cleanSku = sku.trim().toUpperCase();

    const existing = await db.collection('products').findOne({ sku: cleanSku });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A product with SKU '${cleanSku}' already exists.`
      });
    }

    const initialStock = Number(stock) || 0;
    const threshold = Number(lowStockThreshold) || 5;
    let stockStatus = 'in_stock';
    if (initialStock <= 0) stockStatus = 'out_of_stock';
    else if (initialStock <= threshold) stockStatus = 'low_stock';

    const uploadedImageUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.imageUrl || '');

    const parsedBadges = Array.isArray(badges) ? badges : (typeof badges === 'string' ? badges.split(',').map(b => b.trim()).filter(Boolean) : ['3-Piece Suit', 'Unstitched']);

    const productDoc = {
      name: name.trim(),
      sku: cleanSku,
      category,
      fabricType: fabricType || 'Lawn',
      color: color || '',
      description: description || '',
      costPrice: Number(costPrice) || 0,
      retailPrice: Number(retailPrice) || 0,
      wholesalePrice: wholesalePrice !== undefined ? Number(wholesalePrice) : Number(retailPrice),
      salePrice: salePrice !== undefined ? Number(salePrice) : null,
      isOnSale: Boolean(isOnSale),
      stock: initialStock,
      lowStockThreshold: threshold,
      stockStatus,
      badges: parsedBadges.length > 0 ? parsedBadges : ['3-Piece Suit', 'Unstitched'],
      emojiIcon: emojiIcon || '👗',
      imageUrl: uploadedImageUrl,
      images: uploadedImageUrl ? [uploadedImageUrl] : (Array.isArray(images) ? images : []),
      featured: Boolean(featured),
      active: active !== undefined ? Boolean(active) : true,
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('products').insertOne(productDoc);
    const productId = result.insertedId;

    // If initial stock > 0, record opening stock movement
    if (initialStock > 0) {
      await recordMovement({
        productId,
        quantity: initialStock,
        movementType: MOVEMENT_TYPES.OPENING_STOCK,
        reference: 'Initial Product Stock',
        referenceId: productId,
        unitCost: productDoc.costPrice,
        unitPrice: productDoc.retailPrice,
        userId: req.user._id,
        notes: 'Initial inventory creation'
      });
    }

    await logAudit({
      userId: req.user._id,
      username: req.user.username,
      action: 'CREATE_PRODUCT',
      entity: 'products',
      entityId: productId,
      details: { sku: cleanSku, name: productDoc.name, stock: initialStock }
    });

    productDoc._id = productId;
    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      product: productDoc
    });
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();

    const product = await db.collection('products').findOne({ _id: new ObjectId(id) });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    const {
      name,
      sku,
      category,
      fabricType,
      color,
      description,
      costPrice,
      retailPrice,
      wholesalePrice,
      salePrice,
      isOnSale,
      lowStockThreshold,
      badges,
      emojiIcon,
      images,
      featured,
      active
    } = req.body;

    const updates = { updatedAt: new Date() };

    if (name !== undefined) updates.name = name.trim();
    if (category !== undefined) updates.category = category;
    if (fabricType !== undefined) updates.fabricType = fabricType;
    if (color !== undefined) updates.color = color;
    if (description !== undefined) updates.description = description;
    if (costPrice !== undefined) updates.costPrice = Number(costPrice);
    if (retailPrice !== undefined) updates.retailPrice = Number(retailPrice);
    if (wholesalePrice !== undefined) updates.wholesalePrice = Number(wholesalePrice);
    if (salePrice !== undefined) updates.salePrice = salePrice ? Number(salePrice) : null;
    if (isOnSale !== undefined) updates.isOnSale = Boolean(isOnSale);
    if (req.body.stock !== undefined) {
      updates.stock = Number(req.body.stock);
    }
    if (req.file) {
      updates.imageUrl = `/uploads/${req.file.filename}`;
      updates.images = [updates.imageUrl];
    } else if (req.body.imageUrl !== undefined) {
      updates.imageUrl = req.body.imageUrl;
      if (req.body.imageUrl) updates.images = [req.body.imageUrl];
    }
    if (badges !== undefined) {
      updates.badges = Array.isArray(badges) ? badges : (typeof badges === 'string' ? badges.split(',').map(b => b.trim()).filter(Boolean) : [badges]);
    }
    if (emojiIcon !== undefined) updates.emojiIcon = emojiIcon;
    if (images !== undefined && !req.file) updates.images = Array.isArray(images) ? images : [];
    if (featured !== undefined) updates.featured = Boolean(featured);
    if (active !== undefined) updates.active = Boolean(active);

    if (sku && sku.trim().toUpperCase() !== product.sku) {
      const cleanSku = sku.trim().toUpperCase();
      const existingSku = await db.collection('products').findOne({
        sku: cleanSku,
        _id: { $ne: product._id }
      });
      if (existingSku) {
        return res.status(409).json({
          success: false,
          message: `Another product with SKU '${cleanSku}' already exists.`
        });
      }
      updates.sku = cleanSku;
    }

    // Refresh stockStatus based on current stock and new threshold
    const currentStock = Number(product.stock || 0);
    const threshold = updates.lowStockThreshold !== undefined ? updates.lowStockThreshold : Number(product.lowStockThreshold || 5);
    if (currentStock <= 0) updates.stockStatus = 'out_of_stock';
    else if (currentStock <= threshold) updates.stockStatus = 'low_stock';
    else updates.stockStatus = 'in_stock';

    await db.collection('products').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    await logAudit({
      userId: req.user._id,
      username: req.user.username,
      action: 'UPDATE_PRODUCT',
      entity: 'products',
      entityId: id,
      details: { updatedFields: Object.keys(updates) }
    });

    res.json({
      success: true,
      message: 'Product updated successfully.'
    });
  } catch (err) {
    next(err);
  }
}

async function archiveProduct(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();

    const product = await db.collection('products').findOne({ _id: new ObjectId(id) });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    // Check if sales exist for this product
    const salesCount = await db.collection('sales').countDocuments({
      'items.productId': product._id
    });

    // Never permanently delete if sales exist; always soft-archive
    await db.collection('products').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          isArchived: true,
          active: false,
          updatedAt: new Date()
        }
      }
    );

    await logAudit({
      userId: req.user._id,
      username: req.user.username,
      action: 'ARCHIVE_PRODUCT',
      entity: 'products',
      entityId: id,
      details: { sku: product.sku, salesHistoryCount: salesCount }
    });

    res.json({
      success: true,
      message: salesCount > 0
        ? 'Product has sales history and has been archived safely.'
        : 'Product archived successfully.'
    });
  } catch (err) {
    next(err);
  }
}

async function uploadProductImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded.'
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Image uploaded successfully.',
      imageUrl: fileUrl,
      filename: req.file.filename
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPublicProducts,
  getProductById,
  getAdminProducts,
  createProduct,
  updateProduct,
  archiveProduct,
  uploadProductImage
};
