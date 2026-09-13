const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');
const { recordMovement } = require('../services/inventoryService');
const { logAudit } = require('../services/auditService');
const { MOVEMENT_TYPES } = require('../config/constants');

async function getReturns(req, res, next) {
  try {
    const db = getDb();
    const { startDate, endDate, limit = 50, page = 1 } = req.query;

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

    const skip = (Number(page) - 1) * Number(limit);
    const total = await db.collection('returns').countDocuments(query);
    const returns = await db.collection('returns')
      .find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    res.json({
      success: true,
      total,
      returns
    });
  } catch (err) {
    next(err);
  }
}

async function createSaleReturn(req, res, next) {
  try {
    const {
      invoiceNumber,
      items, // array of { productId, quantity, refundUnitPrice }
      refundPaymentMethod = 'Cash',
      reason = '',
      refundAmount
    } = req.body;

    if (!invoiceNumber || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Original invoice number and returned items are required.'
      });
    }

    const db = getDb();
    const originalSale = await db.collection('sales').findOne({ invoiceNumber: invoiceNumber.trim() });
    if (!originalSale) {
      return res.status(404).json({
        success: false,
        message: `Sale with invoice #${invoiceNumber} not found.`
      });
    }

    // Generate Return ID: RET-YYYYMMDD-XXXX
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await db.collection('returns').countDocuments({
      returnNumber: { $regex: `^RET-${todayStr}-` }
    });
    const seq = String(countToday + 1).padStart(4, '0');
    const returnNumber = `RET-${todayStr}-${seq}`;

    let totalRefund = 0;
    let totalCostReversed = 0;
    const processedItems = [];

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
      const originalItem = (originalSale.items || []).find(i => String(i.productId) === String(product._id));
      const refundRate = item.refundUnitPrice !== undefined
        ? Number(item.refundUnitPrice)
        : (originalItem ? Number(originalItem.unitPrice) : Number(product.retailPrice));

      const costRate = originalItem ? Number(originalItem.unitCost || 0) : Number(product.costPrice || 0);

      const lineRefund = qty * refundRate;
      const lineCostReversed = qty * costRate;

      totalRefund += lineRefund;
      totalCostReversed += lineCostReversed;

      processedItems.push({
        productId: product._id,
        name: product.name,
        sku: product.sku,
        quantity: qty,
        refundRate,
        costRate,
        lineRefund,
        lineCostReversed
      });
    }

    const finalRefund = refundAmount !== undefined ? Number(refundAmount) : totalRefund;

    const returnDoc = {
      returnNumber,
      originalInvoiceNumber: originalSale.invoiceNumber,
      saleId: originalSale._id,
      customerId: originalSale.customerId,
      customerName: originalSale.customerName,
      customerPhone: originalSale.customerPhone,
      date: new Date(),
      items: processedItems,
      totalRefundAmount: finalRefund,
      totalCostReversed,
      refundPaymentMethod,
      reason: reason || 'Customer return',
      processedBy: req.user ? req.user.username : 'staff',
      createdAt: new Date()
    };

    const retResult = await db.collection('returns').insertOne(returnDoc);
    returnDoc._id = retResult.insertedId;

    // 1. Restock items via Inventory Movement
    for (const item of processedItems) {
      await recordMovement({
        productId: item.productId,
        quantity: item.quantity,
        movementType: MOVEMENT_TYPES.RETURN,
        reference: `Return #${returnNumber} (Inv #${originalSale.invoiceNumber})`,
        referenceId: returnDoc._id,
        unitCost: item.costRate,
        unitPrice: item.refundRate,
        userId: req.user ? req.user._id : null,
        notes: `Returned item restocked. Reason: ${reason}`
      });
    }

    // 2. Adjust customer balance if sale was on credit/had customer
    if (originalSale.customerId) {
      await db.collection('customers').updateOne(
        { _id: originalSale.customerId },
        {
          $inc: {
            totalPurchases: -finalRefund,
            outstandingBalance: -finalRefund
          },
          $set: { updatedAt: new Date() }
        }
      );

      await db.collection('customer_transactions').insertOne({
        customerId: originalSale.customerId,
        customerName: originalSale.customerName,
        invoiceNumber: originalSale.invoiceNumber,
        date: new Date(),
        type: 'SALE_RETURN',
        debit: 0,
        credit: finalRefund,
        balanceChange: -finalRefund,
        paymentMethod: refundPaymentMethod,
        notes: `Return #${returnNumber} on invoice #${originalSale.invoiceNumber}`
      });
    }

    await logAudit({
      userId: req.user ? req.user._id : null,
      username: req.user ? req.user.username : 'staff',
      action: 'SALE_RETURN',
      entity: 'returns',
      entityId: returnDoc._id,
      details: {
        returnNumber,
        originalInvoiceNumber: originalSale.invoiceNumber,
        totalRefundAmount: finalRefund
      }
    });

    res.status(201).json({
      success: true,
      message: `Return processed. Restocked ${processedItems.length} items.`,
      returnDoc
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getReturns,
  createSaleReturn
};
