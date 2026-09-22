const { getDb } = require('../config/db');
const { logAudit } = require('../services/auditService');

async function getReconciliationSummary(req, res, next) {
  try {
    const db = getDb();
    const { date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const accounts = ['Cash', 'Bank', 'JazzCash', 'EasyPaisa'];
    const summary = {};

    for (const acc of accounts) {
      // 1. Sales in this account
      const sales = await db.collection('sales').find({
        date: { $gte: startOfDay, $lte: endOfDay },
        paymentMethod: acc,
        status: { $ne: 'cancelled' }
      }).toArray();
      const salesIn = sales.reduce((sum, s) => sum + Number(s.amountPaid || s.total || 0), 0);

      // 2. Customer Payments in this account
      const custPayments = await db.collection('customer_transactions').find({
        date: { $gte: startOfDay, $lte: endOfDay },
        paymentMethod: acc,
        type: 'PAYMENT_RECEIVED'
      }).toArray();
      const customerIn = custPayments.reduce((sum, cp) => sum + Number(cp.credit || 0), 0);

      // 3. Expenses in this account
      const expenses = await db.collection('expenses').find({
        date: { $gte: startOfDay, $lte: endOfDay },
        paymentMethod: acc
      }).toArray();
      const expenseOut = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

      // 4. Supplier Payments in this account
      const supPayments = await db.collection('supplier_transactions').find({
        date: { $gte: startOfDay, $lte: endOfDay },
        paymentMethod: acc,
        type: 'PAYMENT_MADE'
      }).toArray();
      const supplierOut = supPayments.reduce((sum, sp) => sum + Number(sp.paidAmount || 0), 0);

      // 5. Returns refunded in this account
      const returns = await db.collection('returns').find({
        date: { $gte: startOfDay, $lte: endOfDay },
        refundPaymentMethod: acc
      }).toArray();
      const returnOut = returns.reduce((sum, r) => sum + Number(r.totalRefundAmount || 0), 0);

      // 6. Manual Bank / Cash Transactions (Direct Deposits & Withdrawals / Transfers)
      const manualEntries = await db.collection('bank_transactions').find({
        date: { $gte: startOfDay, $lte: endOfDay },
        account: acc
      }).toArray();

      const manualIn = manualEntries
        .filter(m => m.type === 'DEPOSIT' || m.type === 'TRANSFER_IN')
        .reduce((sum, m) => sum + Number(m.amount || 0), 0);

      const manualOut = manualEntries
        .filter(m => m.type === 'WITHDRAWAL' || m.type === 'TRANSFER_OUT')
        .reduce((sum, m) => sum + Number(m.amount || 0), 0);

      const totalIn = salesIn + customerIn + manualIn;
      const totalOut = expenseOut + supplierOut + returnOut + manualOut;
      const netDailyFlow = totalIn - totalOut;

      // Check for saved reconciliation entry
      const existingEntry = await db.collection('reconciliations').findOne({
        date: { $gte: startOfDay, $lte: endOfDay },
        account: acc
      });

      const openingBalance = existingEntry ? Number(existingEntry.openingBalance || 0) : 0;
      const expectedClosing = openingBalance + netDailyFlow;
      const actualClosing = existingEntry ? Number(existingEntry.actualClosing || expectedClosing) : expectedClosing;
      const discrepancy = actualClosing - expectedClosing;

      summary[acc] = {
        account: acc,
        openingBalance,
        salesIn,
        customerIn,
        manualIn,
        totalIn,
        expenseOut,
        supplierOut,
        returnOut,
        manualOut,
        totalOut,
        netDailyFlow,
        expectedClosing,
        actualClosing,
        discrepancy,
        status: discrepancy === 0 ? 'Balanced' : (discrepancy > 0 ? 'Surplus' : 'Deficit'),
        reconciled: Boolean(existingEntry && existingEntry.isReconciled),
        notes: existingEntry ? existingEntry.notes : ''
      };
    }

    res.json({
      success: true,
      date: startOfDay.toISOString().slice(0, 10),
      summary
    });
  } catch (err) {
    next(err);
  }
}

async function saveReconciliation(req, res, next) {
  try {
    const { date, account, openingBalance, actualClosing, notes } = req.body;

    if (!account) {
      return res.status(400).json({
        success: false,
        message: 'Account name is required.'
      });
    }

    const db = getDb();
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const doc = {
      date: startOfDay,
      account,
      openingBalance: Number(openingBalance) || 0,
      actualClosing: Number(actualClosing) || 0,
      notes: notes || '',
      isReconciled: true,
      updatedAt: new Date(),
      updatedBy: req.user ? req.user.username : 'staff'
    };

    await db.collection('reconciliations').updateOne(
      { date: startOfDay, account },
      { $set: doc },
      { upsert: true }
    );

    await logAudit({
      userId: req.user ? req.user._id : null,
      username: req.user ? req.user.username : 'staff',
      action: 'RECONCILE_ACCOUNT',
      entity: 'reconciliations',
      details: { account, actualClosing }
    });

    res.json({
      success: true,
      message: `${account} reconciliation saved successfully.`
    });
  } catch (err) {
    next(err);
  }
}

async function recordBankTransaction(req, res, next) {
  try {
    const { account, type, amount, reference, notes, date, toAccount } = req.body;
    const db = getDb();

    const validAccounts = ['Bank', 'Cash', 'JazzCash', 'EasyPaisa'];
    if (!account || !validAccounts.includes(account)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing account.' });
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than zero.' });
    }

    const targetDate = date ? new Date(date) : new Date();

    if (type === 'TRANSFER') {
      if (!toAccount || !validAccounts.includes(toAccount) || toAccount === account) {
        return res.status(400).json({ success: false, message: 'Invalid destination account for transfer.' });
      }

      // Outflow from source
      await db.collection('bank_transactions').insertOne({
        account,
        type: 'TRANSFER_OUT',
        amount: numAmount,
        reference: reference || '',
        notes: notes || `Transfer to ${toAccount}`,
        counterpartAccount: toAccount,
        date: targetDate,
        recordedBy: req.user ? req.user.username : 'admin',
        createdAt: new Date()
      });

      // Inflow to destination
      await db.collection('bank_transactions').insertOne({
        account: toAccount,
        type: 'TRANSFER_IN',
        amount: numAmount,
        reference: reference || '',
        notes: notes || `Transfer from ${account}`,
        counterpartAccount: account,
        date: targetDate,
        recordedBy: req.user ? req.user.username : 'admin',
        createdAt: new Date()
      });

      return res.json({
        success: true,
        message: `Transfer of Rs. ${numAmount} from ${account} to ${toAccount} recorded.`
      });
    }

    if (!['DEPOSIT', 'WITHDRAWAL'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be DEPOSIT, WITHDRAWAL, or TRANSFER.' });
    }

    await db.collection('bank_transactions').insertOne({
      account,
      type, // 'DEPOSIT' (paisa aya) or 'WITHDRAWAL' (paisa nikala)
      amount: numAmount,
      reference: reference || '',
      notes: notes || '',
      date: targetDate,
      recordedBy: req.user ? req.user.username : 'admin',
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: `${type === 'DEPOSIT' ? 'Deposit (Paisa Aaya)' : 'Withdrawal (Paisa Nikala)'} of Rs. ${numAmount} recorded on ${account}.`
    });
  } catch (err) {
    next(err);
  }
}

async function getBankTransactions(req, res, next) {
  try {
    const { date, account, limit = 50 } = req.query;
    const db = getDb();
    const query = {};

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }

    if (account && account !== 'All') {
      query.account = account;
    }

    const transactions = await db.collection('bank_transactions')
      .find(query)
      .sort({ date: -1, createdAt: -1 })
      .limit(Number(limit))
      .toArray();

    res.json({
      success: true,
      transactions
    });
  } catch (err) {
    next(err);
  }
}

async function deleteBankTransaction(req, res, next) {
  try {
    const { id } = req.params;
    const { ObjectId } = require('mongodb');
    const db = getDb();

    await db.collection('bank_transactions').deleteOne({ _id: new ObjectId(id) });

    res.json({
      success: true,
      message: 'Bank transaction entry removed.'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getReconciliationSummary,
  saveReconciliation,
  recordBankTransaction,
  getBankTransactions,
  deleteBankTransaction
};

