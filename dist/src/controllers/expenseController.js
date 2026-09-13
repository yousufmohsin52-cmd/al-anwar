const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');
const { logAudit } = require('../services/auditService');

async function getExpenses(req, res, next) {
  try {
    const db = getDb();
    const { startDate, endDate, category, paymentMethod, limit = 100, page = 1 } = req.query;

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

    if (category && category !== 'All') {
      query.category = category;
    }

    if (paymentMethod && paymentMethod !== 'All') {
      query.paymentMethod = paymentMethod;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await db.collection('expenses').countDocuments(query);
    const expenses = await db.collection('expenses')
      .find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    // Total expense amount for query
    const sumResult = await db.collection('expenses').aggregate([
      { $match: query },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
    ]).toArray();

    const totalExpenseAmount = sumResult[0] ? sumResult[0].totalAmount : 0;

    res.json({
      success: true,
      total,
      totalExpenseAmount,
      expenses
    });
  } catch (err) {
    next(err);
  }
}

async function createExpense(req, res, next) {
  try {
    const {
      category,
      description,
      amount,
      paymentMethod = 'Cash',
      paidBy,
      receiptImage,
      notes,
      date
    } = req.body;

    if (!category || amount === undefined || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Category and a valid positive amount are required.'
      });
    }

    const db = getDb();
    const expenseDoc = {
      date: date ? new Date(date) : new Date(),
      category: category.trim(),
      description: description ? description.trim() : '',
      amount: Number(amount),
      paymentMethod: paymentMethod || 'Cash',
      paidBy: paidBy ? paidBy.trim() : (req.user ? req.user.username : 'staff'),
      receiptImage: receiptImage || (req.file ? `/uploads/${req.file.filename}` : null),
      notes: notes || '',
      createdById: req.user ? req.user._id : null,
      createdAt: new Date()
    };

    const result = await db.collection('expenses').insertOne(expenseDoc);
    expenseDoc._id = result.insertedId;

    await logAudit({
      userId: req.user ? req.user._id : null,
      username: req.user ? req.user.username : 'staff',
      action: 'CREATE_EXPENSE',
      entity: 'expenses',
      entityId: expenseDoc._id,
      details: { category: expenseDoc.category, amount: expenseDoc.amount }
    });

    res.status(201).json({
      success: true,
      message: 'Expense recorded successfully.',
      expense: expenseDoc
    });
  } catch (err) {
    next(err);
  }
}

async function deleteExpense(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();

    const expense = await db.collection('expenses').findOne({ _id: new ObjectId(id) });
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found.'
      });
    }

    await db.collection('expenses').deleteOne({ _id: new ObjectId(id) });

    await logAudit({
      userId: req.user._id,
      username: req.user.username,
      action: 'DELETE_EXPENSE',
      entity: 'expenses',
      entityId: id,
      details: { category: expense.category, amount: expense.amount }
    });

    res.json({
      success: true,
      message: 'Expense deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getExpenses,
  createExpense,
  deleteExpense
};
