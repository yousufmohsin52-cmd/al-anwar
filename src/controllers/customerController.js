const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');
const { logAudit } = require('../services/auditService');

async function getCustomers(req, res, next) {
  try {
    const db = getDb();
    const { search, hasBalance } = req.query;

    const query = {};
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { phone: { $regex: search.trim(), $options: 'i' } },
        { address: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    if (hasBalance === 'true') {
      query.outstandingBalance = { $gt: 0 };
    }

    const customers = await db.collection('customers')
      .find(query)
      .sort({ outstandingBalance: -1, name: 1 })
      .toArray();

    res.json({
      success: true,
      count: customers.length,
      customers
    });
  } catch (err) {
    next(err);
  }
}

async function getCustomerLedger(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();

    const customer = await db.collection('customers').findOne({ _id: new ObjectId(id) });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.'
      });
    }

    // Get all transactions
    const transactions = await db.collection('customer_transactions')
      .find({ customerId: customer._id })
      .sort({ date: 1 })
      .toArray();

    // Get sales invoices
    const sales = await db.collection('sales')
      .find({ customerId: customer._id })
      .sort({ date: -1 })
      .toArray();

    // Compute running balance
    let runningBalance = Number(customer.openingBalance || 0);
    const ledgerEntries = [];

    if (customer.openingBalance && customer.openingBalance !== 0) {
      ledgerEntries.push({
        date: customer.createdAt,
        type: 'OPENING_BALANCE',
        description: 'Opening Balance',
        debit: customer.openingBalance > 0 ? customer.openingBalance : 0,
        credit: customer.openingBalance < 0 ? Math.abs(customer.openingBalance) : 0,
        balance: runningBalance
      });
    }

    transactions.forEach(t => {
      const debit = Number(t.debit || 0);
      const credit = Number(t.credit || 0);
      runningBalance += (debit - credit);

      ledgerEntries.push({
        date: t.date,
        type: t.type,
        invoiceNumber: t.invoiceNumber,
        description: t.notes || (t.type === 'SALE' ? `Invoice #${t.invoiceNumber}` : 'Payment Received'),
        paymentMethod: t.paymentMethod,
        debit,
        credit,
        balance: runningBalance
      });
    });

    res.json({
      success: true,
      customer,
      summary: {
        openingBalance: customer.openingBalance || 0,
        totalPurchases: customer.totalPurchases || 0,
        totalPaid: customer.totalPaid || 0,
        currentBalance: customer.outstandingBalance || 0
      },
      ledger: ledgerEntries,
      sales
    });
  } catch (err) {
    next(err);
  }
}

async function createCustomer(req, res, next) {
  try {
    const { name, phone, address, openingBalance = 0, notes } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and phone number are required.'
      });
    }

    const db = getDb();
    const cleanPhone = phone.trim();

    const existing = await db.collection('customers').findOne({ phone: cleanPhone });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A customer with phone number '${cleanPhone}' already exists (${existing.name}).`
      });
    }

    const openBal = Number(openingBalance) || 0;
    const newCustomer = {
      name: name.trim(),
      phone: cleanPhone,
      address: address ? address.trim() : '',
      openingBalance: openBal,
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: openBal,
      notes: notes || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('customers').insertOne(newCustomer);
    newCustomer._id = result.insertedId;

    await logAudit({
      userId: req.user ? req.user._id : null,
      username: req.user ? req.user.username : 'staff',
      action: 'CREATE_CUSTOMER',
      entity: 'customers',
      entityId: result.insertedId,
      details: { name: newCustomer.name, phone: newCustomer.phone, openingBalance: openBal }
    });

    res.status(201).json({
      success: true,
      message: 'Customer account created successfully.',
      customer: newCustomer
    });
  } catch (err) {
    next(err);
  }
}

async function recordCustomerPayment(req, res, next) {
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
    const customer = await db.collection('customers').findOne({ _id: new ObjectId(id) });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.'
      });
    }

    const newOutstanding = Math.max(0, Number(customer.outstandingBalance || 0) - payAmount);
    const newTotalPaid = Number(customer.totalPaid || 0) + payAmount;

    await db.collection('customers').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          outstandingBalance: newOutstanding,
          totalPaid: newTotalPaid,
          updatedAt: new Date()
        }
      }
    );

    // Record ledger entry
    await db.collection('customer_transactions').insertOne({
      customerId: customer._id,
      customerName: customer.name,
      date: new Date(),
      type: 'PAYMENT_RECEIVED',
      debit: 0,
      credit: payAmount,
      balanceChange: -payAmount,
      paymentMethod,
      reference: reference || '',
      notes: notes || `Payment received via ${paymentMethod}`,
      receivedBy: req.user ? req.user.username : 'staff'
    });

    await logAudit({
      userId: req.user ? req.user._id : null,
      username: req.user ? req.user.username : 'staff',
      action: 'CUSTOMER_PAYMENT',
      entity: 'customers',
      entityId: id,
      details: {
        customerName: customer.name,
        amount: payAmount,
        previousBalance: customer.outstandingBalance,
        newOutstanding
      }
    });

    res.json({
      success: true,
      message: `Payment of Rs. ${payAmount} recorded successfully.`,
      newOutstandingBalance: newOutstanding
    });
  } catch (err) {
    next(err);
  }
}

async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();
    const { name, phone, address, notes, outstandingBalance } = req.body;

    const customer = await db.collection('customers').findOne({ _id: new ObjectId(id) });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const updates = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (address !== undefined) updates.address = address.trim();
    if (notes !== undefined) updates.notes = notes.trim();

    if (outstandingBalance !== undefined) {
      const newBal = Number(outstandingBalance) || 0;
      const oldBal = Number(customer.outstandingBalance || 0);
      const diff = newBal - oldBal;

      updates.outstandingBalance = newBal;

      if (diff !== 0) {
        await db.collection('customer_transactions').insertOne({
          customerId: customer._id,
          customerName: updates.name || customer.name,
          date: new Date(),
          type: 'MANUAL_ADJUSTMENT',
          debit: diff > 0 ? diff : 0,
          credit: diff < 0 ? Math.abs(diff) : 0,
          balanceChange: diff,
          notes: `Khata Udhaar adjusted by Admin from Rs. ${oldBal} to Rs. ${newBal}`,
          adjustedBy: req.user ? req.user.username : 'admin'
        });
      }
    }

    await db.collection('customers').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    await logAudit({
      userId: req.user ? req.user._id : null,
      username: req.user ? req.user.username : 'admin',
      action: 'UPDATE_CUSTOMER',
      entity: 'customers',
      entityId: id,
      details: { updates }
    });

    res.json({
      success: true,
      message: 'Customer khata updated successfully.'
    });
  } catch (err) {
    next(err);
  }
}

async function deleteCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();

    const customer = await db.collection('customers').findOne({ _id: new ObjectId(id) });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    // Delete customer transactions
    await db.collection('customer_transactions').deleteMany({
      $or: [
        { customerId: new ObjectId(id) },
        { customerId: id }
      ]
    });

    // Delete customer
    await db.collection('customers').deleteOne({ _id: new ObjectId(id) });

    await logAudit({
      userId: req.user ? req.user._id : null,
      username: req.user ? req.user.username : 'admin',
      action: 'DELETE_CUSTOMER',
      entity: 'customers',
      entityId: id,
      details: { customerName: customer.name, phone: customer.phone }
    });

    res.json({
      success: true,
      message: `Customer ${customer.name} and Khata ledger deleted.`
    });
  } catch (err) {
    next(err);
  }
}

async function deleteCustomerTransaction(req, res, next) {
  try {
    const { txnId } = req.params;
    const db = getDb();

    const txn = await db.collection('customer_transactions').findOne({ _id: new ObjectId(txnId) });
    if (!txn) {
      return res.status(404).json({ success: false, message: 'Transaction entry not found.' });
    }

    // Revert impact on customer balance
    // balanceChange: debit increases balance, credit decreases balance
    const change = Number(txn.balanceChange || (Number(txn.debit || 0) - Number(txn.credit || 0)));
    if (txn.customerId) {
      await db.collection('customers').updateOne(
        { _id: new ObjectId(txn.customerId) },
        {
          $inc: { outstandingBalance: -change },
          $set: { updatedAt: new Date() }
        }
      );
    }

    await db.collection('customer_transactions').deleteOne({ _id: new ObjectId(txnId) });

    res.json({
      success: true,
      message: 'Transaction entry deleted and customer balance adjusted.'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCustomers,
  getCustomerLedger,
  createCustomer,
  recordCustomerPayment,
  updateCustomer,
  deleteCustomer,
  deleteCustomerTransaction
};

