const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');
const { MOVEMENT_TYPES } = require('../config/constants');

async function recordMovement({
  productId,
  quantity,
  movementType,
  reference,
  referenceId,
  unitCost,
  unitPrice,
  userId,
  notes
}) {
  const db = getDb();
  const productObjId = typeof productId === 'string' ? new ObjectId(productId) : productId;

  const product = await db.collection('products').findOne({ _id: productObjId });
  if (!product) {
    throw new Error(`Product with ID ${productId} not found.`);
  }

  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Movement quantity must be a positive number.');
  }

  let stockChange = 0;
  switch (movementType) {
    case MOVEMENT_TYPES.STOCK_IN:
    case MOVEMENT_TYPES.RETURN:
    case MOVEMENT_TYPES.OPENING_STOCK:
      stockChange = qty;
      break;

    case MOVEMENT_TYPES.SALE:
    case MOVEMENT_TYPES.DAMAGE:
    case MOVEMENT_TYPES.LOSS:
      stockChange = -qty;
      break;

    case MOVEMENT_TYPES.ADJUSTMENT:
      stockChange = qty; // can be positive or negative in adjustments
      break;

    default:
      throw new Error(`Invalid movement type: ${movementType}`);
  }

  const currentStock = Number(product.stock || 0);
  const newStock = currentStock + stockChange;

  if (newStock < 0 && (movementType === MOVEMENT_TYPES.SALE || movementType === MOVEMENT_TYPES.DAMAGE)) {
    throw new Error(`Insufficient stock for '${product.name}'. Available: ${currentStock}, Requested: ${qty}`);
  }

  // Record the movement
  const movementDoc = {
    productId: productObjId,
    productName: product.name,
    sku: product.sku,
    quantity: qty,
    stockChange,
    previousStock: currentStock,
    newStock,
    movementType,
    reference: reference || 'Manual',
    referenceId: referenceId ? String(referenceId) : null,
    unitCost: unitCost !== undefined ? Number(unitCost) : Number(product.costPrice || 0),
    unitPrice: unitPrice !== undefined ? Number(unitPrice) : Number(product.retailPrice || 0),
    userId: userId ? String(userId) : 'system',
    notes: notes || '',
    date: new Date()
  };

  await db.collection('inventory_movements').insertOne(movementDoc);

  // Update product stock and status
  const lowStockThreshold = Number(product.lowStockThreshold || 5);
  let stockStatus = 'in_stock';
  if (newStock <= 0) {
    stockStatus = 'out_of_stock';
  } else if (newStock <= lowStockThreshold) {
    stockStatus = 'low_stock';
  }

  await db.collection('products').updateOne(
    { _id: productObjId },
    {
      $set: {
        stock: newStock,
        stockStatus,
        updatedAt: new Date()
      }
    }
  );

  return {
    success: true,
    previousStock: currentStock,
    newStock,
    stockChange,
    stockStatus
  };
}

async function getStockSummary() {
  const db = getDb();
  const products = await db.collection('products').find({ isArchived: { $ne: true } }).toArray();

  let totalItems = 0;
  let totalUnits = 0;
  let totalCostValue = 0;
  let totalRetailValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  products.forEach(p => {
    const stock = Number(p.stock || 0);
    const cost = Number(p.costPrice || 0);
    const retail = Number(p.retailPrice || 0);
    const threshold = Number(p.lowStockThreshold || 5);

    totalItems += 1;
    totalUnits += stock;
    totalCostValue += stock * cost;
    totalRetailValue += stock * retail;

    if (stock <= 0) {
      outOfStockCount += 1;
    } else if (stock <= threshold) {
      lowStockCount += 1;
    }
  });

  return {
    totalItems,
    totalUnits,
    totalCostValue,
    totalRetailValue,
    expectedGrossProfit: totalRetailValue - totalCostValue,
    lowStockCount,
    outOfStockCount
  };
}

module.exports = {
  recordMovement,
  getStockSummary
};
