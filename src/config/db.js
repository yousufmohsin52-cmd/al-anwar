const dns = require('dns');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// Fix Windows SRV DNS resolution for MongoDB Atlas only on Windows
if (process.platform === 'win32') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  } catch (e) {
    console.warn('DNS server configuration warning:', e.message);
  }
}

const uri = process.env.MONGODB_URI || 'mongodb+srv://yousufmohsin52_db_user:ZqZ6cP0Wyjk8GOej@cluster0.khoadig.mongodb.net/?appName=Cluster0';
const dbName = process.env.DB_NAME || 'al_anwar_db';


let client = null;
let db = null;

async function connectDB() {
  if (db) return db;

  try {
    client = new MongoClient(uri, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000
    });

    await client.connect();
    db = client.db(dbName);
    console.log(`[MongoDB Atlas] Successfully connected to database: ${dbName}`);

    // Create required indexes
    await initIndexes(db);

    return db;
  } catch (err) {
    console.error('[MongoDB Atlas] Connection failed:', err.message);
    throw err;
  }
}

async function initIndexes(database) {
  try {
    // Users: unique email/username
    await database.collection('users').createIndex({ username: 1 }, { unique: true });
    await database.collection('users').createIndex({ email: 1 }, { sparse: true });

    // Products: unique SKU, category, active status
    await database.collection('products').createIndex({ sku: 1 }, { unique: true });
    await database.collection('products').createIndex({ category: 1, active: 1 });
    await database.collection('products').createIndex({ name: 'text', fabricType: 'text', sku: 'text' });

    // Sales: unique invoiceNumber, customerPhone, date
    await database.collection('sales').createIndex({ invoiceNumber: 1 }, { unique: true });
    await database.collection('sales').createIndex({ date: -1 });
    await database.collection('sales').createIndex({ customerPhone: 1 });
    await database.collection('sales').createIndex({ customerId: 1 });

    // Purchases: unique purchaseNumber, supplier, date
    await database.collection('purchases').createIndex({ purchaseNumber: 1 }, { unique: true });
    await database.collection('purchases').createIndex({ date: -1 });
    await database.collection('purchases').createIndex({ supplierId: 1 });

    // Inventory Movements: productId, date, movementType
    await database.collection('inventory_movements').createIndex({ productId: 1, date: -1 });
    await database.collection('inventory_movements').createIndex({ movementType: 1 });

    // Expenses: date, category
    await database.collection('expenses').createIndex({ date: -1 });
    await database.collection('expenses').createIndex({ category: 1 });

    // Customers: phone unique
    await database.collection('customers').createIndex({ phone: 1 }, { unique: true });

    // Suppliers: name / phone
    await database.collection('suppliers').createIndex({ phone: 1 }, { sparse: true });

    // Customer transactions & Supplier transactions
    await database.collection('customer_transactions').createIndex({ customerId: 1, date: -1 });
    await database.collection('supplier_transactions').createIndex({ supplierId: 1, date: -1 });

    // Audit Logs
    await database.collection('audit_logs').createIndex({ timestamp: -1 });
    await database.collection('audit_logs').createIndex({ userId: 1 });

    console.log('[MongoDB Atlas] Database indexes verified and initialized.');
  } catch (indexErr) {
    console.warn('[MongoDB Atlas] Index creation note:', indexErr.message);
  }
}

function getDb() {
  if (!db) {
    throw new Error('Database is not initialized. Call connectDB() first.');
  }
  return db;
}

module.exports = {
  connectDB,
  getDb,
  getClient: () => client
};
