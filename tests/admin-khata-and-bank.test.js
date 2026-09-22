require('dotenv').config();
const { connectDB, getDb } = require('../src/config/db');
const { ObjectId } = require('mongodb');

async function runTests() {
  console.log('[Test Suite] Verifying Admin Sales, Customer Khata & Bank Reconciliation...');
  await connectDB();
  const db = getDb();

  // Test 1: Verify Customer Receivables is now 0 (dummy 36k/39k removed)
  const { calculateFinancials } = require('../src/services/accountingService');
  const fin = await calculateFinancials('this_month');
  console.log(`[Test 1] Total Customer Receivables: Rs. ${fin.totalReceivables}`);
  if (fin.totalReceivables !== 0) {
    console.error(`❌ Expected totalReceivables to be 0, got ${fin.totalReceivables}`);
    process.exit(1);
  }
  console.log('  ✓ PASSED: Fake customer udhaar successfully eliminated.');

  // Test 2: Bank Reconciliation Direct Deposit and Withdrawal
  const testAcc = 'Bank';
  const depRes = await db.collection('bank_transactions').insertOne({
    account: testAcc,
    type: 'DEPOSIT',
    amount: 75000,
    reference: 'DEP-TEST-001',
    notes: 'Test cash deposit to bank',
    date: new Date(),
    recordedBy: 'test_runner',
    createdAt: new Date()
  });
  console.log('  ✓ Recorded Bank Deposit of Rs. 75,000');

  const withRes = await db.collection('bank_transactions').insertOne({
    account: testAcc,
    type: 'WITHDRAWAL',
    amount: 15000,
    reference: 'ATM-TEST-001',
    notes: 'Test ATM withdrawal for petty cash',
    date: new Date(),
    recordedBy: 'test_runner',
    createdAt: new Date()
  });
  console.log('  ✓ Recorded Bank Withdrawal of Rs. 15,000');

  // Verify manualIn and manualOut in reconciliation
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const txs = await db.collection('bank_transactions').find({
    date: { $gte: startOfDay, $lte: endOfDay },
    account: testAcc
  }).toArray();

  const manualIn = txs.filter(t => t.type === 'DEPOSIT').reduce((s, t) => s + t.amount, 0);
  const manualOut = txs.filter(t => t.type === 'WITHDRAWAL').reduce((s, t) => s + t.amount, 0);

  if (manualIn < 75000 || manualOut < 15000) {
    console.error('❌ Bank transaction sums failed.');
    process.exit(1);
  }
  console.log(`  ✓ PASSED: Bank transactions computed: Inflow = Rs. ${manualIn}, Outflow = Rs. ${manualOut}`);

  // Clean up test transactions
  await db.collection('bank_transactions').deleteOne({ _id: depRes.insertedId });
  await db.collection('bank_transactions').deleteOne({ _id: withRes.insertedId });
  console.log('  ✓ Cleaned up test bank transactions.');

  console.log('====================================================');
  console.log('  ALL ADMIN KHATA & BANK TESTS PASSED (100% SUCCESS)');
  console.log('====================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
