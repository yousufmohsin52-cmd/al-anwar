const { getDb } = require('../config/db');

function getDateRangeFilter(period, startDate, endDate) {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'yesterday':
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;

    case 'this_week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      break;
    }

    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      break;

    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;

    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      break;

    case 'custom':
      if (startDate) {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
      } else {
        start = new Date(0);
      }
      if (endDate) {
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
      } else {
        end = new Date();
        end.setHours(23, 59, 59, 999);
      }
      break;

    case 'all':
    default:
      start = new Date(0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
}

async function calculateFinancials({ period = 'today', startDate, endDate } = {}) {
  const db = getDb();
  const { start, end } = getDateRangeFilter(period, startDate, endDate);

  const dateQuery = {
    date: {
      $gte: start,
      $lte: end
    }
  };

  // 1. Fetch Sales in range
  const sales = await db.collection('sales').find({
    ...dateQuery,
    status: { $ne: 'cancelled' }
  }).toArray();

  let grossRevenue = 0;
  let totalDiscount = 0;
  let netRevenue = 0;
  let costOfGoodsSold = 0;
  let totalSalesCount = sales.length;
  let totalItemsSold = 0;

  const paymentBreakdown = {
    Cash: 0,
    Bank: 0,
    JazzCash: 0,
    EasyPaisa: 0,
    Credit: 0
  };

  sales.forEach(sale => {
    const subtotal = Number(sale.subtotal || sale.grossTotal || 0);
    const discount = Number(sale.discount || 0);
    const netTotal = Number(sale.total || (subtotal - discount));
    const cogs = Number(sale.totalCost || 0);

    grossRevenue += subtotal;
    totalDiscount += discount;
    netRevenue += netTotal;
    costOfGoodsSold += cogs;

    // Items count
    if (Array.isArray(sale.items)) {
      sale.items.forEach(item => {
        totalItemsSold += Number(item.quantity || 0);
      });
    }

    // Payment breakdown
    const method = sale.paymentMethod || 'Cash';
    if (paymentBreakdown[method] !== undefined) {
      paymentBreakdown[method] += netTotal;
    } else {
      paymentBreakdown.Cash += netTotal;
    }
  });

  // 2. Fetch Sales Returns in range (Reversals)
  const returns = await db.collection('returns').find(dateQuery).toArray();
  let totalReturnsAmount = 0;
  let returnsCogsReversal = 0;

  returns.forEach(ret => {
    totalReturnsAmount += Number(ret.totalRefundAmount || 0);
    returnsCogsReversal += Number(ret.totalCostReversed || 0);
  });

  // Net sales adjusted for returns
  netRevenue = Math.max(0, netRevenue - totalReturnsAmount);
  costOfGoodsSold = Math.max(0, costOfGoodsSold - returnsCogsReversal);

  // 3. Gross Profit
  const grossProfit = netRevenue - costOfGoodsSold;
  const grossMarginPercent = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

  // 4. Operating Expenses in range
  const expenses = await db.collection('expenses').find(dateQuery).toArray();
  let operatingExpenses = 0;
  const expenseByCategory = {};

  expenses.forEach(exp => {
    const amount = Number(exp.amount || 0);
    operatingExpenses += amount;
    const cat = exp.category || 'Miscellaneous';
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + amount;
  });

  // 5. Net Profit
  const netProfit = grossProfit - operatingExpenses;
  const netProfitMarginPercent = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

  // 6. Outstanding Receivables & Payables
  const customers = await db.collection('customers').find().toArray();
  const totalReceivables = customers.reduce((sum, c) => sum + Math.max(0, Number(c.outstandingBalance || 0)), 0);

  const suppliers = await db.collection('suppliers').find().toArray();
  const totalPayables = suppliers.reduce((sum, s) => sum + Math.max(0, Number(s.outstandingPayable || 0)), 0);

  return {
    period,
    dateRange: { start, end },
    totalSalesCount,
    totalItemsSold,
    grossRevenue,
    totalDiscount,
    netRevenue,
    costOfGoodsSold,
    grossProfit,
    grossMarginPercent: Number(grossMarginPercent.toFixed(2)),
    operatingExpenses,
    expenseByCategory,
    netProfit,
    netProfitMarginPercent: Number(netProfitMarginPercent.toFixed(2)),
    paymentBreakdown,
    totalReturnsAmount,
    totalReceivables,
    totalPayables
  };
}

module.exports = {
  calculateFinancials,
  getDateRangeFilter
};
