const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');
const { recordMovement } = require('../services/inventoryService');
const { logAudit } = require('../services/auditService');
const { MOVEMENT_TYPES } = require('../config/constants');

async function getPurchases(req, res, next) {
  try {
    const db = getDb();
    const { startDate, endDate, supplierId, limit = 50, page = 1 } = req.query;

    const query = {};
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    if (supplierId && ObjectId.isValid(supplierId)) {
      query.supplierId = new ObjectId(supplierId);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await db.collection('purchases').countDocuments(query);
    const purchases = await db.collection('purchases')
      .find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    res.json({
      success: true,
      total,
      purchases
    });
  } catch (err) {
    next(err);
  }
}

async function createPurchase(req, res, next) {
  try {
    const {
      supplierId,
      supplierName,
      supplierPhone,
      supplierInvoiceNumber,
      items, // array of { productId, quantity, costPrice }
      paymentMethod = 'Cash',
      amountPaid = 0,
      notes = ''
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Purchase must contain at least one product item.'
      });
    }

    const db = getDb();

    // Generate purchase number: PUR-YYYYMMDD-XXXX
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await db.collection('purchases').countDocuments({
      purchaseNumber: { $regex: `^PUR-${todayStr}-` }
    });
    const seq = String(countToday + 1).padStart(4, '0');
    const purchaseNumber = `PUR-${todayStr}-${seq}`;

    const processedItems = [];
    let totalCost = 0;

    for (const item of items) {
      const pId = typeof item.productId === 'string' ? new ObjectId(item.productId) : item.productId;
      const product = await db.collection('products').findOne({ _id: pId });

      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product with ID ${item.productId} was not found.`
        });
      }

      const qty = Number(item.quantity) || 1;
      const cost = Number(item.costPrice !== undefined ? item.costPrice : product.costPrice) || 0;
      const lineCost = qty * cost;
      totalCost += lineCost;

      processedItems.push({
        productId: product._id,
        name: product.name,
        sku: product.sku,
        quantity: qty,
        costPrice: cost,
        lineCost
      });
    }

    const paid = Number(amountPaid) || 0;
    const remainingPayable = Math.max(0, totalCost - paid);

    // 1. Resolve or create Supplier
    let resolvedSupplierId = null;
    let supplierDoc = null;

    if (supplierId && ObjectId.isValid(supplierId)) {
      supplierDoc = await db.collection('suppliers').findOne({ _id: new ObjectId(supplierId) });
      if (supplierDoc) resolvedSupplierId = supplierDoc._id;
    } else if (supplierName && supplierName.trim()) {
      const nameClean = supplierName.trim();
      supplierDoc = await db.collection('suppliers').findOne({ name: nameClean });
      if (supplierDoc) {
        resolvedSupplierId = supplierDoc._id;
      } else {
        const newSup = {
          name: nameClean,
          phone: supplierPhone || '',
          company: '',
          address: '',
          openingPayable: 0,
          totalPurchases: 0,
          totalPaid: 0,
          outstandingPayable: 0,
          createdAt: new Date()
        };
        const supRes = await db.collection('suppliers').insertOne(newSup);
        resolvedSupplierId = supRes.insertedId;
        supplierDoc = { ...newSup, _id: supRes.insertedId };
      }
    }

    // 2. Create Purchase Document
    const purchaseDoc = {
      purchaseNumber,
      supplierInvoiceNumber: supplierInvoiceNumber ? supplierInvoiceNumber.trim() : '',
      supplierId: resolvedSupplierId,
      supplierName: supplierDoc ? supplierDoc.name : (supplierName || 'General Supplier/Mill'),
      supplierPhone: supplierDoc ? supplierDoc.phone : (supplierPhone || ''),
      date: new Date(),
      items: processedItems,
      totalCost,
      paymentMethod,
      amountPaid: paid,
      remainingPayable,
      status: 'received',
      notes: notes || '',
      createdBy: req.user ? req.user.username : 'staff',
      createdAt: new Date()
    };

    const purchaseRes = await db.collection('purchases').insertOne(purchaseDoc);
    purchaseDoc._id = purchaseRes.insertedId;

    // 3. Increase inventory for each item & update product cost price
    for (const item of processedItems) {
      // Update latest cost price on product
      await db.collection('products').updateOne(
        { _id: item.productId },
        {
          $set: {
            costPrice: item.costPrice,
            updatedAt: new Date()
          }
        }
      );

      await recordMovement({
        productId: item.productId,
        quantity: item.quantity,
        movementType: MOVEMENT_TYPES.STOCK_IN,
        reference: `Purchase #${purchaseNumber}`,
        referenceId: purchaseDoc._id,
        unitCost: item.costPrice,
        userId: req.user ? req.user._id : null,
        notes: `Stock In from supplier: ${purchaseDoc.supplierName}`
      });
    }

    // 4. Update Supplier Ledger
    if (resolvedSupplierId) {
      await db.collection('suppliers').updateOne(
        { _id: resolvedSupplierId },
        {
          $inc: {
            totalPurchases: totalCost,
            totalPaid: paid,
            outstandingPayable: remainingPayable
          },
          $set: { updatedAt: new Date() }
        }
      );

      await db.collection('supplier_transactions').insertOne({
        supplierId: resolvedSupplierId,
        supplierName: purchaseDoc.supplierName,
        purchaseNumber,
        purchaseId: purchaseDoc._id,
        date: new Date(),
        type: 'PURCHASE',
        billAmount: totalCost,
        paidAmount: paid,
        balanceChange: remainingPayable,
        paymentMethod,
        notes: `Purchase #${purchaseNumber}`
      });
    }

    await logAudit({
      userId: req.user ? req.user._id : null,
      username: req.user ? req.user.username : 'staff',
      action: 'CREATE_PURCHASE',
      entity: 'purchases',
      entityId: purchaseDoc._id,
      details: {
        purchaseNumber,
        totalCost,
        itemsCount: processedItems.length,
        supplier: purchaseDoc.supplierName
      }
    });

    res.status(201).json({
      success: true,
      message: 'Stock purchase confirmed and inventory updated.',
      purchase: purchaseDoc
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPurchases,
  createPurchase
};
