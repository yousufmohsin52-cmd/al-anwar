const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');
const { logAudit } = require('../services/auditService');

async function getSuppliers(req, res, next) {
  try {
    const db = getDb();
    const { search } = req.query;

    const query = {};
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { company: { $regex: search.trim(), $options: 'i' } },
        { phone: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const suppliers = await db.collection('suppliers')
      .find(query)
      .sort({ outstandingPayable: -1, name: 1 })
      .toArray();

    res.json({
      success: true,
      count: suppliers.length,
      suppliers
    });
  } catch (err) {
    next(err);
  }
}

async function getSupplierLedger(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();

    const supplier = await db.collection('suppliers').findOne({ _id: new ObjectId(id) });
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found.'
      });
    }

    const transactions = await db.collection('supplier_transactions')
      .find({ supplierId: supplier._id })
      .sort({ date: 1 })
      .toArray();

    const purchases = await db.collection('purchases')
      .find({ supplierId: supplier._id })
      .sort({ date: -1 })
      .toArray();

    let runningBalance = Number(supplier.openingPayable || 0);
    const ledgerEntries = [];

    if (supplier.openingPayable && supplier.openingPayable !== 0) {
      ledgerEntries.push({
        date: supplier.createdAt,
        type: 'OPENING_PAYABLE',
        description: 'Opening Payable',
        billAmount: supplier.openingPayable,
        paidAmount: 0,
        balance: runningBalance
      });
    }

    transactions.forEach(t => {
      const bill = Number(t.billAmount || 0);
      const paid = Number(t.paidAmount || 0);
      runningBalance += (bill - paid);

      ledgerEntries.push({
        date: t.date,
        type: t.type,
        purchaseNumber: t.purchaseNumber,
        description: t.notes || (t.type === 'PURCHASE' ? `Purchase #${t.purchaseNumber}` : 'Payment Paid'),
        paymentMethod: t.paymentMethod,
        billAmount: bill,
        paidAmount: paid,
        balance: runningBalance
      });
    });

    res.json({
      success: true,
      supplier,
      summary: {
        openingPayable: supplier.openingPayable || 0,
        totalPurchases: supplier.totalPurchases || 0,
        totalPaid: supplier.totalPaid || 0,
        currentPayable: supplier.outstandingPayable || 0
      },
      ledger: ledgerEntries,
      purchases
    });
  } catch (err) {
    next(err);
  }
}

async function createSupplier(req, res, next) {
  try {
    const { name, phone, company, address, openingPayable = 0, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Supplier name is required.'
      });
    }

    const db = getDb();
    const openPay = Number(openingPayable) || 0;

    const newSupplier = {
      name: name.trim(),
      phone: phone ? phone.trim() : '',
      company: company ? company.trim() : '',
      address: address ? address.trim() : '',
      openingPayable: openPay,
      totalPurchases: 0,
      totalPaid: 0,
      outstandingPayable: openPay,
      notes: notes || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('suppliers').insertOne(newSupplier);
    newSupplier._id = result.insertedId;

    await logAudit({
      userId: req.user ? req.user._id : null,
      username: req.user ? req.user.username : 'staff',
      action: 'CREATE_SUPPLIER',
      entity: 'suppliers',
      entityId: result.insertedId,
      details: { name: newSupplier.name, company: newSupplier.company, openingPayable: openPay }
    });

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully.',
      supplier: newSupplier
    });
  } catch (err) {
    next(err);
  }
}

async function recordSupplierPayment(req, res, next) {
  try {
    const { id } = req.params;
    const { amount, paymentMethod = 'Cash', notes, reference } = req.body;

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be a positive number.'
      });
    }

    const db = getDb();
    const supplier = await db.collection('suppliers').findOne({ _id: new ObjectId(id) });
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found.'
      });
    }

    const newPayable = Math.max(0, Number(supplier.outstandingPayable || 0) - payAmount);
    const newTotalPaid = Number(supplier.totalPaid || 0) + payAmount;

    await db.collection('suppliers').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          outstandingPayable: newPayable,
          totalPaid: newTotalPaid,
          updatedAt: new Date()
        }
      }
    );

    // Record supplier ledger transaction
    await db.collection('supplier_transactions').insertOne({
      supplierId: supplier._id,
      supplierName: supplier.name,
      date: new Date(),
      type: 'PAYMENT_MADE',
      billAmount: 0,
      paidAmount: payAmount,
      balanceChange: -payAmount,
      paymentMethod,
      reference: reference || '',
      notes: notes || `Paid to supplier via ${paymentMethod}`,
      paidBy: req.user ? req.user.username : 'staff'
    });

    await logAudit({
      userId: req.user ? req.user._id : null,
      username: req.user ? req.user.username : 'staff',
      action: 'SUPPLIER_PAYMENT',
      entity: 'suppliers',
      entityId: id,
      details: {
        supplierName: supplier.name,
        amount: payAmount,
        previousPayable: supplier.outstandingPayable,
        newPayable
      }
    });

    res.json({
      success: true,
      message: `Payment of Rs. ${payAmount} to ${supplier.name} recorded.`,
      newOutstandingPayable: newPayable
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSuppliers,
  getSupplierLedger,
  createSupplier,
  recordSupplierPayment
};
