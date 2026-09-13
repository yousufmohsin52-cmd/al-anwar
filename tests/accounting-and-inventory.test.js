const assert = require('assert');
const { connectDB, getDb, getClient } = require('../src/config/db');
const { calculateFinancials } = require('../src/services/accountingService');
const { recordMovement, getStockSummary } = require('../src/services/inventoryService');
const { MOVEMENT_TYPES } = require('../src/config/constants');

async function runTests() {
  console.log('[Test Suite] Running automated verification for Accounting & Inventory...');
  await connectDB();
  const db = getDb();

  // Test 1: Verify Accounting Financials Equation
  console.log('[Test 1] Verifying Financials: Revenue - COGS = Gross Profit and Gross Profit - Expenses = Net Profit');
  const financials = await calculateFinancials({ period: 'all' });

  console.log('  Calculated Financials Summary:', {
    grossRevenue: financials.grossRevenue,
    totalDiscount: financials.totalDiscount,
    netRevenue: financials.netRevenue,
    costOfGoodsSold: financials.costOfGoodsSold,
    grossProfit: financials.grossProfit,
    operatingExpenses: financials.operatingExpenses,
    netProfit: financials.netProfit
  });

  // Verify equation: Gross Profit = Net Revenue - COGS
  assert.strictEqual(
    financials.grossProfit,
    financials.netRevenue - financials.costOfGoodsSold,
    'Gross Profit must equal Net Revenue minus COGS'
  );

  // Verify equation: Net Profit = Gross Profit - Operating Expenses
  assert.strictEqual(
    financials.netProfit,
    financials.grossProfit - financials.operatingExpenses,
    'Net Profit must equal Gross Profit minus Operating Expenses'
  );
  console.log('  ✓ PASSED: Accounting equations strictly balance.');

  // Test 2: Verify Stock Valuation and Inventory Movements
  console.log('[Test 2] Verifying Inventory Movement on product...');
  const sampleProduct = await db.collection('products').findOne({ isArchived: { $ne: true } });
  assert(sampleProduct, 'Sample product should exist');

  const initialStock = Number(sampleProduct.stock);
  console.log(`  Initial stock for '${sampleProduct.name}': ${initialStock}`);

  // Perform STOCK_IN
  const stockInRes = await recordMovement({
    productId: sampleProduct._id,
    quantity: 5,
    movementType: MOVEMENT_TYPES.STOCK_IN,
    reference: 'Automated Test Stock In',
    unitCost: sampleProduct.costPrice,
    notes: 'Testing stock addition'
  });
  assert.strictEqual(stockInRes.newStock, initialStock + 5, 'Stock should increase by 5');
  console.log(`  ✓ PASSED: Stock in increased stock to ${stockInRes.newStock}`);

  // Perform SALE deduction
  const saleRes = await recordMovement({
    productId: sampleProduct._id,
    quantity: 5,
    movementType: MOVEMENT_TYPES.SALE,
    reference: 'Automated Test Sale Reversal',
    unitCost: sampleProduct.costPrice,
    notes: 'Testing stock reduction'
  });
  assert.strictEqual(saleRes.newStock, initialStock, 'Stock should return to initialStock');
  console.log(`  ✓ PASSED: Sale movement reduced stock back to ${saleRes.newStock}`);

  // Test 3: Stock valuation summary
  const summary = await getStockSummary();
  assert(summary.totalUnits > 0, 'Total units should be greater than 0');
  assert(summary.totalCostValue > 0, 'Total cost value should be positive');
  assert(summary.totalRetailValue >= summary.totalCostValue, 'Retail value should be >= Cost value');
  console.log('  Stock Valuation:', {
    totalItems: summary.totalItems,
    totalUnits: summary.totalUnits,
    totalCostValue: summary.totalCostValue,
    totalRetailValue: summary.totalRetailValue
  });
  console.log('  ✓ PASSED: Inventory valuation summary verified.');

  console.log('====================================================');
  console.log('  ALL AUTOMATED TESTS PASSED (100% SUCCESS)');
  console.log('====================================================');

  const client = getClient();
  if (client) await client.close();
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
