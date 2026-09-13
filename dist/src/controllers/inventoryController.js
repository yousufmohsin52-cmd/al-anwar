const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');
const { recordMovement, getStockSummary } = require('../services/inventoryService');
const { logAudit } = require('../services/auditService');

async function getMovements(req, res, next) {
  try {
    const db = getDb();
    const { productId, movementType, limit = 100, page = 1 } = req.query;

    const query = {};
    if (productId && ObjectId.isValid(productId)) {
      query.productId = new ObjectId(productId);
    }
    if (movementType && movementType !== 'All') {
      query.movementType = movementType;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await db.collection('inventory_movements').countDocuments(query);
    const movements = await db.collection('inventory_movements')
      .find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    res.json({
      success: true,
      total,
      movements
    });
  } catch (err) {
    next(err);
  }
}

async function createAdjustment(req, res, next) {
  try {
    const { productId, quantity, movementType, notes } = req.body;

    if (!productId || quantity === undefined || !movementType) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, quantity and movement type are required.'
      });
    }

    const result = await recordMovement({
      productId,
      quantity: Number(quantity),
      movementType,
      reference: 'Manual Adjustment',
      userId: req.user._id,
      notes: notes || `Manual stock adjustment: ${movementType}`
    });

    await logAudit({
      userId: req.user._id,
      username: req.user.username,
      action: 'STOCK_ADJUSTMENT',
      entity: 'products',
      entityId: productId,
      details: { movementType, quantity, result }
    });

    res.json({
      success: true,
      message: 'Stock adjustment applied successfully.',
      result
    });
  } catch (err) {
    next(err);
  }
}

async function getValuation(req, res, next) {
  try {
    const summary = await getStockSummary();
    res.json({
      success: true,
      summary
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMovements,
  createAdjustment,
  getValuation
};
