const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');
const { recordMovement } = require('../services/inventoryService');
const { logAudit } = require('../services/auditService');
const { MOVEMENT_TYPES } = require('../config/constants');

async function getSales(req, res, next) {
  try {
    const db = getDb();
    const { startDate, endDate, paymentMethod, saleType, search, limit = 100, page = 1 } = req.query;

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

    if (paymentMethod && paymentMethod !== 'All') {
      query.paymentMethod = paymentMethod;
    }

    if (saleType && saleType !== 'All') {
      query.saleType = saleType;
    }

    if (search && search.trim()) {
      query.$or = [
        { invoiceNumber: { $regex: search.trim(), $options: 'i' } },
        { customerName: { $regex: search.trim(), $options: 'i' } },
        { customerPhone: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await db.collection('sales').countDocuments(query);
    const sales = await db.collection('sales')
      .find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    res.json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      sales
    });
  } catch (err) {
    next(err);
  }
}

async function getSaleById(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();

    let query = {};
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { invoiceNumber: id };
    }

    const sale = await db.collection('sales').findOne(query);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale invoice not found.'
      });
    }

    res.json({
      success: true,
      sale
    });
  } catch (err) {
    next(err);
  }
}

async function createSale(req, res, next) {
  try {
    const {
      customerId,
      customerName,
      customerPhone,
      customerAddress,
      saleType = 'retail', // 'retail' or 'wholesale'
      items, // array of { productId, quantity, unitPrice, discount }
      discount = 0,
      paymentMethod = 'Cash',
      amountPaid = 0,
      notes = ''
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sale must contain at least one product item.'
      });
    }

    const db = getDb();

    // Generate unique invoice number: ANW-YYYYMMDD-XXXX
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await db.collection('sales').countDocuments({
      invoiceNumber: { $regex: `^ANW-${todayStr}-` }
    });
    const seq = String(countToday + 1).padStart(4, '0');
    const invoiceNumber = `ANW-${todayStr}-${seq}`;

    // Verify items, compute costs, subtotal, and stock
    const processedItems = [];
    let grossSubtotal = 0;
    let itemsDiscount = 0;
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
      if (qty <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for product '${product.name}'.`
        });
      }

      // Check available stock
      if (Number(product.stock || 0) < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for '${product.name}'. Available: ${product.stock}, Requested: ${qty}`
        });
      }

      const unitPrice = item.unitPrice !== undefined
        ? Number(item.unitPrice)
        : (saleType === 'wholesale' ? Number(product.wholesalePrice || product.retailPrice) : Number(product.salePrice || product.retailPrice));

      const itemCost = Number(product.costPrice || 0);
      const itemDisc = Number(item.discount || 0);
      const lineGross = unitPrice * qty;
      const lineNet = lineGross - itemDisc;

      grossSubtotal += lineGross;
      itemsDiscount += itemDisc;
      totalCost += itemCost * qty;

      processedItems.push({
        productId: product._id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        fabricType: product.fabricType,
        quantity: qty,
        unitPrice,
        unitCost: itemCost,
        discount: itemDisc,
        lineTotal: lineNet,
        lineCost: itemCost * qty,
        lineProfit: lineNet - (itemCost * qty)
      });
    }

    const overallDiscount = Number(discount) || 0;
    const totalDiscount = itemsDiscount + overallDiscount;
    const netTotal = Math.max(0, grossSubtotal - totalDiscount);
    const grossProfit = netTotal - totalCost;

    // Payment validation
    const paid = Number(amountPaid) !== undefined ? Number(amountPaid) : (paymentMethod === 'Credit' ? 0 : netTotal);
    const balanceDue = Math.max(0, netTotal - paid);

    let paymentStatus = 'Paid';
    if (balanceDue > 0 && paid > 0) paymentStatus = 'Partial';
    else if (balanceDue > 0 && paid === 0) paymentStatus = 'Unpaid';

    // 1. Resolve or Create Customer
    let resolvedCustomerId = null;
    let customerDoc = null;

    if (customerId && ObjectId.isValid(customerId)) {
      customerDoc = await db.collection('customers').findOne({ _id: new ObjectId(customerId) });
      if (customerDoc) resolvedCustomerId = customerDoc._id;
    } else if (customerPhone && customerPhone.trim()) {
      const phoneClean = customerPhone.trim();
      customerDoc = await db.collection('customers').findOne({ phone: phoneClean });
      if (customerDoc) {
        resolvedCustomerId = customerDoc._id;
      } else if (customerName && customerName.trim()) {
        const newCust = {
          name: customerName.trim(),
          phone: phoneClean,
          address: customerAddress || '',
          openingBalance: 0,
          totalPurchases: 0,
          totalPaid: 0,
          outstandingBalance: 0,
          createdAt: new Date()
        };
        const custResult = await db.collection('customers').insertOne(newCust);
        resolvedCustomerId = custResult.insertedId;
        customerDoc = { ...newCust, _id: custResult.insertedId };
      }
    }

    // 2. Insert Sale Document
    const saleDoc = {
      invoiceNumber,
      date: new Date(),
      customerId: resolvedCustomerId,
      customerName: customerName ? customerName.trim() : (customerDoc ? customerDoc.name : 'Walk-in Customer'),
      customerPhone: customerPhone ? customerPhone.trim() : (customerDoc ? customerDoc.phone : ''),
      saleType,
      items: processedItems,
      grossTotal: grossSubtotal,
      subtotal: grossSubtotal,
      discount: totalDiscount,
      total: netTotal,
      totalCost,
      grossProfit,
      paymentMethod,
      amountPaid: paid,
      balanceDue,
      paymentStatus,
      notes: notes ? notes.trim() : '',
      createdBy: req.user ? req.user.username : 'staff',
      createdById: req.user ? req.user._id : null,
      status: 'completed',
      createdAt: new Date()
    };

    const saleResult = await db.collection('sales').insertOne(saleDoc);
    saleDoc._id = saleResult.insertedId;

    // 3. Deduct inventory for all items sold
    for (const item of processedItems) {
      await recordMovement({
        productId: item.productId,
        quantity: item.quantity,
        movementType: MOVEMENT_TYPES.SALE,
        reference: `Sale #${invoiceNumber}`,
        referenceId: saleDoc._id,
        unitCost: item.unitCost,
        unitPrice: item.unitPrice,
        userId: req.user ? req.user._id : null,
        notes: `Sold via ${paymentMethod} to ${saleDoc.customerName}`
      });
    }

    // 4. Update Customer Ledger if customer exists
    if (resolvedCustomerId) {
      await db.collection('customers').updateOne(
        { _id: resolvedCustomerId },
        {
          $inc: {
            totalPurchases: netTotal,
            totalPaid: paid,
            outstandingBalance: balanceDue
          },
          $set: { updatedAt: new Date() }
        }
      );

      // Record Customer Ledger Transaction
      await db.collection('customer_transactions').insertOne({
        customerId: resolvedCustomerId,
        customerName: saleDoc.customerName,
        invoiceNumber,
        saleId: saleDoc._id,
        date: new Date(),
        type: 'SALE',
        debit: netTotal,   // what customer owes
        credit: paid,      // what customer paid
        balanceChange: balanceDue,
        paymentMethod,
        notes: `Invoice #${invoiceNumber}`
      });
    }

    await logAudit({
      userId: req.user ? req.user._id : null,
      username: req.user ? req.user.username : 'staff',
      action: 'CREATE_SALE',
      entity: 'sales',
      entityId: saleDoc._id,
      details: {
        invoiceNumber,
        total: netTotal,
        itemsCount: processedItems.length,
        paymentMethod
      }
    });

    res.status(201).json({
      success: true,
      message: 'Sale completed successfully.',
      invoiceNumber,
      sale: saleDoc
    });
  } catch (err) {
    next(err);
  }
}

async function cancelSale(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();

    const sale = await db.collection('sales').findOne({ _id: new ObjectId(id) });
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found.'
      });
    }

    if (sale.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This sale is already cancelled.'
      });
    }

    // Restore stock for each item
    for (const item of sale.items) {
      await recordMovement({
        productId: item.productId,
        quantity: item.quantity,
        movementType: MOVEMENT_TYPES.RETURN,
        reference: `Cancelled Sale #${sale.invoiceNumber}`,
        referenceId: sale._id,
        unitCost: item.unitCost,
        unitPrice: item.unitPrice,
        userId: req.user._id,
        notes: 'Stock restored due to sale cancellation'
      });
    }

    // Reverse customer balances
    if (sale.customerId) {
      await db.collection('customers').updateOne(
        { _id: sale.customerId },
        {
          $inc: {
            totalPurchases: -Number(sale.total || 0),
            totalPaid: -Number(sale.amountPaid || 0),
            outstandingBalance: -Number(sale.balanceDue || 0)
          },
          $set: { updatedAt: new Date() }
        }
      );

      await db.collection('customer_transactions').insertOne({
        customerId: sale.customerId,
        customerName: sale.customerName,
        invoiceNumber: sale.invoiceNumber,
        saleId: sale._id,
        date: new Date(),
        type: 'SALE_CANCELLED',
        debit: 0,
        credit: sale.total,
        balanceChange: -Number(sale.balanceDue || 0),
        notes: `Cancellation of invoice #${sale.invoiceNumber}`
      });
    }

    await db.collection('sales').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: req.user.username
        }
      }
    );

    await logAudit({
      userId: req.user._id,
      username: req.user.username,
      action: 'CANCEL_SALE',
      entity: 'sales',
      entityId: id,
      details: { invoiceNumber: sale.invoiceNumber }
    });

    res.json({
      success: true,
      message: `Sale #${sale.invoiceNumber} cancelled and inventory restored.`
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSales,
  getSaleById,
  createSale,
  cancelSale
};
