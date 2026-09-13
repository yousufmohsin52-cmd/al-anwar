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

      const totalIn = salesIn + customerIn;
      const totalOut = expenseOut + supplierOut + returnOut;
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
        totalIn,
        expenseOut,
        supplierOut,
        returnOut,
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

module.exports = {
  getReconciliationSummary,
  saveReconciliation
};
