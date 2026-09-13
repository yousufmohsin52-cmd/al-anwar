const { getDb } = require('../config/db');
const { calculateFinancials, getDateRangeFilter } = require('./accountingService');

function convertToCSV(headers, rows) {
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map(row => row.map(escapeCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

async function generateSalesReport({ period = 'this_month', startDate, endDate } = {}) {
  const db = getDb();
  const { start, end } = getDateRangeFilter(period, startDate, endDate);

  const sales = await db.collection('sales').find({
    date: { $gte: start, $lte: end },
    status: { $ne: 'cancelled' }
  }).sort({ date: -1 }).toArray();

  const headers = [
    'Date',
    'Invoice Number',
    'Customer Name',
    'Customer Phone',
    'Sale Type',
    'Items Summary',
    'Total Quantity',
    'Gross Amount (Rs.)',
    'Discount (Rs.)',
    'Net Revenue (Rs.)',
    'COGS (Rs.)',
    'Gross Profit (Rs.)',
    'Payment Method',
    'Payment Status'
  ];

  const rows = sales.map(s => {
    const itemsSummary = (s.items || []).map(i => `${i.productName || i.name} (x${i.quantity})`).join('; ');
    const totalQty = (s.items || []).reduce((sum, i) => sum + Number(i.quantity || 0), 0);
    const profit = Number(s.total || 0) - Number(s.totalCost || 0);

    return [
      new Date(s.date).toLocaleDateString('en-PK'),
      s.invoiceNumber || '',
      s.customerName || 'Walk-in Customer',
      s.customerPhone || '',
      s.saleType || 'retail',
      itemsSummary,
      totalQty,
      s.subtotal || s.total || 0,
      s.discount || 0,
      s.total || 0,
      s.totalCost || 0,
      profit,
      s.paymentMethod || 'Cash',
      s.paymentStatus || 'Paid'
    ];
  });

  return {
    headers,
    rows,
    csv: convertToCSV(headers, rows),
    raw: sales
  };
}

async function generateStockReport() {
  const db = getDb();
  const products = await db.collection('products').find({ isArchived: { $ne: true } }).sort({ category: 1, name: 1 }).toArray();

  const headers = [
    'Product Name',
    'SKU',
    'Category',
    'Fabric Type',
    'Color',
    'Current Stock',
    'Stock Status',
    'Unit Cost Price (Rs.)',
    'Total Cost Value (Rs.)',
    'Retail Price (Rs.)',
    'Total Retail Value (Rs.)',
    'Wholesale Price (Rs.)',
    'Expected Profit (Rs.)'
  ];

  const rows = products.map(p => {
    const stock = Number(p.stock || 0);
    const cost = Number(p.costPrice || 0);
    const retail = Number(p.retailPrice || 0);
    const costVal = stock * cost;
    const retailVal = stock * retail;
    const profit = retailVal - costVal;

    return [
      p.name || '',
      p.sku || '',
      p.category || '',
      p.fabricType || '',
      p.color || '',
      stock,
      p.stockStatus || 'in_stock',
      cost,
      costVal,
      retail,
      retailVal,
      p.wholesalePrice || 0,
      profit
    ];
  });

  return {
    headers,
    rows,
    csv: convertToCSV(headers, rows),
    raw: products
  };
}

async function generateExpenseReport({ period = 'this_month', startDate, endDate } = {}) {
  const db = getDb();
  const { start, end } = getDateRangeFilter(period, startDate, endDate);

  const expenses = await db.collection('expenses').find({
    date: { $gte: start, $lte: end }
  }).sort({ date: -1 }).toArray();

  const headers = [
    'Date',
    'Category',
    'Description',
    'Amount (Rs.)',
    'Payment Method',
    'Paid By',
    'Notes'
  ];

  const rows = expenses.map(e => [
    new Date(e.date).toLocaleDateString('en-PK'),
    e.category || 'Miscellaneous',
    e.description || '',
    e.amount || 0,
    e.paymentMethod || 'Cash',
    e.paidBy || '',
    e.notes || ''
  ]);

  return {
    headers,
    rows,
    csv: convertToCSV(headers, rows),
    raw: expenses
  };
}

async function generateProfitLossReport({ period = 'this_month', startDate, endDate } = {}) {
  const financials = await calculateFinancials({ period, startDate, endDate });

  const headers = ['Financial Metric', 'Amount (PKR / Rs.)', 'Notes / Percentage'];
  const rows = [
    ['Gross Revenue', financials.grossRevenue, 'Total billings before discounts'],
    ['Total Discounts Given', financials.totalDiscount, 'Deductions on wholesale/retail sales'],
    ['Net Revenue (Sales)', financials.netRevenue, 'Actual sales realized'],
    ['Cost of Goods Sold (COGS)', financials.costOfGoodsSold, 'Actual product acquisition cost'],
    ['Gross Profit', financials.grossProfit, `Gross Margin: ${financials.grossMarginPercent}%`],
    ['Total Operating Expenses', financials.operatingExpenses, 'Shop rent, bills, wages, freight, etc.'],
    ['Net Profit', financials.netProfit, `Net Margin: ${financials.netProfitMarginPercent}%`]
  ];

  // Append expense category breakdown
  rows.push(['--- Expense Category Breakdown ---', '', '']);
  Object.entries(financials.expenseByCategory || {}).forEach(([cat, amt]) => {
    rows.push([`Expense: ${cat}`, amt, '']);
  });

  return {
    financials,
    headers,
    rows,
    csv: convertToCSV(headers, rows)
  };
}

async function generateCustomerOutstandingReport() {
  const db = getDb();
  const customers = await db.collection('customers').find().sort({ outstandingBalance: -1 }).toArray();

  const headers = [
    'Customer Name',
    'Phone',
    'Address / City',
    'Opening Balance (Rs.)',
    'Total Purchases (Rs.)',
    'Total Paid (Rs.)',
    'Outstanding Due (Rs.)'
  ];

  const rows = customers.map(c => [
    c.name || '',
    c.phone || '',
    c.address || '',
    c.openingBalance || 0,
    c.totalPurchases || 0,
    c.totalPaid || 0,
    c.outstandingBalance || 0
  ]);

  return {
    headers,
    rows,
    csv: convertToCSV(headers, rows),
    raw: customers
  };
}

async function generateSupplierOutstandingReport() {
  const db = getDb();
  const suppliers = await db.collection('suppliers').find().sort({ outstandingPayable: -1 }).toArray();

  const headers = [
    'Supplier / Mill Name',
    'Contact Person / Phone',
    'Address / Market',
    'Opening Payable (Rs.)',
    'Total Purchases (Rs.)',
    'Total Paid (Rs.)',
    'Outstanding Payable (Rs.)'
  ];

  const rows = suppliers.map(s => [
    s.name || '',
    s.phone || '',
    s.address || '',
    s.openingPayable || 0,
    s.totalPurchases || 0,
    s.totalPaid || 0,
    s.outstandingPayable || 0
  ]);

  return {
    headers,
    rows,
    csv: convertToCSV(headers, rows),
    raw: suppliers
  };
}

module.exports = {
  generateSalesReport,
  generateStockReport,
  generateExpenseReport,
  generateProfitLossReport,
  generateCustomerOutstandingReport,
  generateSupplierOutstandingReport,
  convertToCSV
};
