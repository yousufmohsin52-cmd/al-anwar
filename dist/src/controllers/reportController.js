const { calculateFinancials } = require('../services/accountingService');
const { getStockSummary } = require('../services/inventoryService');
const {
  generateSalesReport,
  generateStockReport,
  generateExpenseReport,
  generateProfitLossReport,
  generateCustomerOutstandingReport,
  generateSupplierOutstandingReport
} = require('../services/reportService');

async function getDashboardStats(req, res, next) {
  try {
    const todayFin = await calculateFinancials({ period: 'today' });
    const monthFin = await calculateFinancials({ period: 'this_month' });
    const stockSummary = await getStockSummary();

    res.json({
      success: true,
      today: {
        sales: todayFin.netRevenue,
        cogs: todayFin.costOfGoodsSold,
        grossProfit: todayFin.grossProfit,
        expenses: todayFin.operatingExpenses,
        netProfit: todayFin.netProfit,
        salesCount: todayFin.totalSalesCount,
        grossMargin: todayFin.grossMarginPercent,
        netMargin: todayFin.netProfitMarginPercent
      },
      thisMonth: {
        sales: monthFin.netRevenue,
        cogs: monthFin.costOfGoodsSold,
        grossProfit: monthFin.grossProfit,
        expenses: monthFin.operatingExpenses,
        netProfit: monthFin.netProfit,
        salesCount: monthFin.totalSalesCount,
        grossMargin: monthFin.grossMarginPercent,
        netMargin: monthFin.netProfitMarginPercent
      },
      inventory: {
        totalItems: stockSummary.totalItems,
        totalUnits: stockSummary.totalUnits,
        totalCostValue: stockSummary.totalCostValue,
        totalRetailValue: stockSummary.totalRetailValue,
        lowStockCount: stockSummary.lowStockCount,
        outOfStockCount: stockSummary.outOfStockCount
      },
      ledgers: {
        customerReceivables: todayFin.totalReceivables,
        supplierPayables: todayFin.totalPayables
      },
      paymentBreakdown: monthFin.paymentBreakdown,
      expenseByCategory: monthFin.expenseByCategory
    });
  } catch (err) {
    next(err);
  }
}

async function getFinancialReport(req, res, next) {
  try {
    const { type = 'sales', period = 'this_month', startDate, endDate, format } = req.query;

    let reportData = null;
    let filename = `Al-Anwar-${type}-report-${Date.now()}`;

    switch (type) {
      case 'sales':
        reportData = await generateSalesReport({ period, startDate, endDate });
        filename = `Al-Anwar-Sales-${period}.csv`;
        break;

      case 'stock':
        reportData = await generateStockReport();
        filename = `Al-Anwar-Stock-Report.csv`;
        break;

      case 'expenses':
        reportData = await generateExpenseReport({ period, startDate, endDate });
        filename = `Al-Anwar-Expenses-${period}.csv`;
        break;

      case 'pl':
      case 'profit_loss':
        reportData = await generateProfitLossReport({ period, startDate, endDate });
        filename = `Al-Anwar-Profit-and-Loss-${period}.csv`;
        break;

      case 'customers':
      case 'receivables':
        reportData = await generateCustomerOutstandingReport();
        filename = `Al-Anwar-Customer-Receivables.csv`;
        break;

      case 'suppliers':
      case 'payables':
        reportData = await generateSupplierOutstandingReport();
        filename = `Al-Anwar-Supplier-Payables.csv`;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: `Unknown report type: ${type}. Supported: sales, stock, expenses, pl, customers, suppliers.`
        });
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(reportData.csv);
    }

    res.json({
      success: true,
      type,
      period,
      headers: reportData.headers,
      rows: reportData.rows,
      raw: reportData.raw,
      financials: reportData.financials
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardStats,
  getFinancialReport
};
