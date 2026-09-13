const bcrypt = require('bcryptjs');
const { connectDB, getDb } = require('../src/config/db');
const { MOVEMENT_TYPES, ROLES } = require('../src/config/constants');
const { recordMovement } = require('../src/services/inventoryService');

async function seed() {
  console.log('[Seeder] Starting database seeding for AL ANWAR FABRICS & CLOTH...');
  const db = await connectDB();

  // 1. Seed Admin Users
  console.log('[Seeder] Creating staff and admin users...');
  const salt = await bcrypt.genSalt(10);
  const passwordHashAdmin = await bcrypt.hash('admin123', salt);
  const passwordHashAcc = await bcrypt.hash('acc123', salt);
  const passwordHashSales = await bcrypt.hash('sales123', salt);
  const passwordHashInv = await bcrypt.hash('inv123', salt);

  const users = [
    {
      username: 'admin',
      fullName: 'Yousuf Mohsin (Shop Owner)',
      email: 'owner@alanwarcloth.com',
      password: passwordHashAdmin,
      role: ROLES.SUPER_ADMIN,
      active: true,
      createdAt: new Date()
    },
    {
      username: 'accountant',
      fullName: 'Muhammad Tariq (Chief Accountant)',
      email: 'accountant@alanwarcloth.com',
      password: passwordHashAcc,
      role: ROLES.ACCOUNTANT,
      active: true,
      createdAt: new Date()
    },
    {
      username: 'sales',
      fullName: 'Kamran Ali (Shop Sales Lead)',
      email: 'sales@alanwarcloth.com',
      password: passwordHashSales,
      role: ROLES.SALES_STAFF,
      active: true,
      createdAt: new Date()
    },
    {
      username: 'inventory',
      fullName: 'Bilal Ahmed (Godown & Stock Manager)',
      email: 'inventory@alanwarcloth.com',
      password: passwordHashInv,
      role: ROLES.INVENTORY_MANAGER,
      active: true,
      createdAt: new Date()
    }
  ];

  for (const u of users) {
    await db.collection('users').updateOne(
      { username: u.username },
      { $set: u },
      { upsert: true }
    );
  }
  const adminUser = await db.collection('users').findOne({ username: 'admin' });

  // 2. Seed Categories
  console.log('[Seeder] Creating categories...');
  const categories = [
    { name: 'New Arrivals', description: 'Fresh arrivals of luxury summer & festive suits', emoji: '✨', sortOrder: 1, isNav: true, active: true },
    { name: 'Unstitched Lawn', description: 'Premium 3-piece pure lawn digital print & embroidered suits', emoji: '👗', sortOrder: 2, isNav: true, active: true },
    { name: 'Luxury Chiffon', description: 'Heavy embroidered pure chiffon festive collection', emoji: '💎', sortOrder: 3, isNav: true, active: true },
    { name: 'Cotton', description: 'Egyptian & Pakistani pure soft cotton suits for daily wear', emoji: '🧵', sortOrder: 4, isNav: true, active: true },
    { name: 'Khaddar', description: 'Premium handloom textured khaddar unstitched fabrics', emoji: '🪡', sortOrder: 5, isNav: true, active: true },
    { name: 'Jacquard', description: 'Gold & silver zari woven jacquard 3-piece ensembles', emoji: '🌸', sortOrder: 6, isNav: true, active: true },
    { name: 'Embroidered', description: 'Intricate thread & sequin embroidered suits with organza dupattas', emoji: '🪡', sortOrder: 7, isNav: true, active: true },
    { name: 'Winter Collection', description: 'Marina, pashmina & warm shawls unstitched collections', emoji: '🧣', sortOrder: 8, isNav: true, active: true },
    { name: 'Wholesale', description: 'Master bundles & whole thaans at factory mill rates for retailers', emoji: '📦', sortOrder: 9, isNav: true, active: true },
    { name: 'Sale', description: 'Special seasonal discounts & clearance offers', emoji: '🏷️', sortOrder: 10, isNav: true, active: true }
  ];

  for (const c of categories) {
    await db.collection('categories').updateOne(
      { name: c.name },
      { $set: c },
      { upsert: true }
    );
  }

  // 3. Seed Realistic Pakistani Fabric Products
  console.log('[Seeder] Creating realistic fabric catalog...');
  const sampleProducts = [
    {
      name: 'Noor-e-Jahan Luxury Embroidered Lawn 3pc',
      sku: 'ANW-LWN-001',
      category: 'Unstitched Lawn',
      fabricType: 'Lawn',
      color: 'Emerald Green & Gold',
      description: 'Exclusive 3-piece unstitched lawn featuring heavily embroidered front on digital printed premium 90/70 lawn, printed cambric trousers, and a lightweight digital voil dupatta.',
      costPrice: 2800,
      retailPrice: 4650,
      wholesalePrice: 3400,
      salePrice: 3950,
      isOnSale: true,
      stock: 45,
      lowStockThreshold: 5,
      badges: ['Best Seller', 'Festive 2026', 'Pure Voil Dupatta'],
      emojiIcon: '👗',
      featured: true,
      active: true,
      isArchived: false,
      isDemo: true
    },
    {
      name: 'Gul-e-Rana Chiffon Formal Festive 3pc',
      sku: 'ANW-CHF-002',
      category: 'Luxury Chiffon',
      fabricType: 'Chiffon',
      color: 'Blush Pink & Rose Gold',
      description: 'Handcrafted zardozi, threadwork, and micro-sequin embroidery on pure crinkle chiffon shirt with embroidered chiffon dupatta and dyed raw silk trouser.',
      costPrice: 5200,
      retailPrice: 8900,
      wholesalePrice: 6500,
      salePrice: null,
      isOnSale: false,
      stock: 22,
      lowStockThreshold: 4,
      badges: ['Luxury Formal', 'Crinkle Chiffon', 'Hand Embellished'],
      emojiIcon: '💎',
      featured: true,
      active: true,
      isArchived: false,
      isDemo: true
    },
    {
      name: 'Karandi Jacquard Gold Zari 3pc',
      sku: 'ANW-JAC-003',
      category: 'Jacquard',
      fabricType: 'Jacquard',
      color: 'Midnight Blue & Metallic Gold',
      description: 'Intricately woven self-jacquard front and back with metallic gold zari motifs, organza embroidered neckline patch, and jacquard bordered dupatta.',
      costPrice: 3600,
      retailPrice: 5850,
      wholesalePrice: 4200,
      salePrice: 5200,
      isOnSale: true,
      stock: 30,
      lowStockThreshold: 5,
      badges: ['Gold Zari Weave', 'Exclusive Motif'],
      emojiIcon: '✨',
      featured: true,
      active: true,
      isArchived: false,
      isDemo: true
    },
    {
      name: 'Mughal Bagh Printed Swiss Lawn 3pc',
      sku: 'ANW-LWN-004',
      category: 'Unstitched Lawn',
      fabricType: 'Swiss Lawn',
      color: 'Mustard Yellow & Ivory',
      description: 'Summer daily wear printed Swiss lawn 3pc with floral Mughal paisley prints and dyed soft cotton trouser.',
      costPrice: 1900,
      retailPrice: 3150,
      wholesalePrice: 2350,
      salePrice: null,
      isOnSale: false,
      stock: 58,
      lowStockThreshold: 8,
      badges: ['Everyday Comfort', 'Cool Fabric'],
      emojiIcon: '🌸',
      featured: false,
      active: true,
      isArchived: false,
      isDemo: true
    },
    {
      name: 'Classic Giza Pure Cotton Kurta Thaan',
      sku: 'ANW-COT-005',
      category: 'Cotton',
      fabricType: 'Pure Cotton',
      color: 'Royal White',
      description: '100% fine staple Egyptian Giza cotton with crisp liquid ammonia finish for gent’s & ladies unstitched kurtas. Soft, breathable, wrinkle-resistant.',
      costPrice: 1400,
      retailPrice: 2450,
      wholesalePrice: 1800,
      salePrice: 2150,
      isOnSale: true,
      stock: 65,
      lowStockThreshold: 10,
      badges: ['100% Pure Cotton', 'Giza Finish'],
      emojiIcon: '🧵',
      featured: true,
      active: true,
      isArchived: false,
      isDemo: true
    },
    {
      name: 'Pashmina Shawl Winter Khaddar 3pc',
      sku: 'ANW-KHD-006',
      category: 'Khaddar',
      fabricType: 'Handloom Khaddar',
      color: 'Rust Orange & Earth Brown',
      description: 'Heavily textured yarn-dyed handloom khaddar with embroidered front and a plush acrylic pashmina printed warm shawl.',
      costPrice: 3100,
      retailPrice: 4950,
      wholesalePrice: 3600,
      salePrice: null,
      isOnSale: false,
      stock: 18,
      lowStockThreshold: 4,
      badges: ['Winter Special', 'Pashmina Shawl'],
      emojiIcon: '🧣',
      featured: false,
      active: true,
      isArchived: false,
      isDemo: true
    },
    {
      name: 'Dhanak Embroidered Cutwork 3pc',
      sku: 'ANW-EMB-007',
      category: 'Embroidered',
      fabricType: 'Dhanak',
      color: 'Ruby Crimson & Maroon',
      description: 'Heavy cutwork embroidery border on front daman and sleeves with embroidered organza dupatta in rich jewel tones.',
      costPrice: 3800,
      retailPrice: 6200,
      wholesalePrice: 4500,
      salePrice: 5600,
      isOnSale: true,
      stock: 14,
      lowStockThreshold: 5,
      badges: ['Cutwork Embroidery', 'Festive Special'],
      emojiIcon: '🪡',
      featured: true,
      active: true,
      isArchived: false,
      isDemo: true
    },
    {
      name: 'Wholesale Master Bundle: Lawn 3pc (10 Suits Set)',
      sku: 'ANW-WHL-008',
      category: 'Wholesale',
      fabricType: 'Lawn',
      color: 'Assorted 10 Colors & Designs',
      description: 'Factory direct wholesale volume pack containing 10 assorted 3-piece lawn suits with catalogue pictures and pouch packaging. Minimum order 1 pack.',
      costPrice: 22000,
      retailPrice: 35000,
      wholesalePrice: 26000,
      salePrice: 25500,
      isOnSale: true,
      stock: 8,
      lowStockThreshold: 2,
      badges: ['Wholesale Only', 'Set of 10 Suits', 'Reseller Pack'],
      emojiIcon: '📦',
      featured: true,
      active: true,
      isArchived: false,
      isDemo: true
    }
  ];

  for (const p of sampleProducts) {
    p.stockStatus = p.stock <= p.lowStockThreshold ? 'low_stock' : 'in_stock';
    p.updatedAt = new Date();
    p.createdAt = new Date();
    await db.collection('products').updateOne(
      { sku: p.sku },
      { $set: p },
      { upsert: true }
    );
  }

  // 4. Seed Customers
  console.log('[Seeder] Creating realistic customer accounts...');
  const customers = [
    {
      name: 'Haji Abdul Rehman (Al-Haram Fabrics, Faisalabad)',
      phone: '03001234567',
      address: 'Shop # 14, Montgomery Bazaar, Faisalabad',
      openingBalance: 25000,
      totalPurchases: 185000,
      totalPaid: 155000,
      outstandingBalance: 55000, // 25k + 185k - 155k
      notes: 'Wholesale client. Regular weekly buyer.',
      isDemo: true,
      createdAt: new Date()
    },
    {
      name: 'Begum Farzana Zafar (Boutique Elegance)',
      phone: '03219876543',
      address: 'Boutique # 4, Zamzama Commercial, DHA Phase 5, Karachi',
      openingBalance: 0,
      totalPurchases: 94000,
      totalPaid: 80000,
      outstandingBalance: 14000,
      notes: 'Retail designer & boutique owner.',
      isDemo: true,
      createdAt: new Date()
    },
    {
      name: 'Muhammad Asif Cloth House',
      phone: '03335557788',
      address: 'Cloth Market, Hyderabad',
      openingBalance: 10000,
      totalPurchases: 120000,
      totalPaid: 130000,
      outstandingBalance: 0,
      notes: 'Reliable payer via Bank Transfer.',
      isDemo: true,
      createdAt: new Date()
    }
  ];

  for (const cust of customers) {
    await db.collection('customers').updateOne(
      { phone: cust.phone },
      { $set: cust },
      { upsert: true }
    );
  }

  // 5. Seed Suppliers
  console.log('[Seeder] Creating supplier textile mills...');
  const suppliers = [
    {
      name: 'Kohinoor Textile Mills Ltd (Weaving & Printing)',
      phone: '04235759900',
      company: 'Kohinoor Textiles',
      address: 'Peshawar Road, Rawalpindi / Lahore Sales Office',
      openingPayable: 150000,
      totalPurchases: 650000,
      totalPaid: 580000,
      outstandingPayable: 220000,
      notes: 'Primary lawn and cotton fabric mill.',
      isDemo: true,
      createdAt: new Date()
    },
    {
      name: 'Sitara Embroidery Mills',
      phone: '0418541122',
      company: 'Sitara Textiles',
      address: 'Small Industrial Estate, Faisalabad',
      openingPayable: 50000,
      totalPurchases: 320000,
      totalPaid: 300000,
      outstandingPayable: 70000,
      notes: 'Heavy multi-head embroidery and cutwork.',
      isDemo: true,
      createdAt: new Date()
    }
  ];

  for (const sup of suppliers) {
    await db.collection('suppliers').updateOne(
      { name: sup.name },
      { $set: sup },
      { upsert: true }
    );
  }

  // 6. Seed Realistic Sales and Inventory Movements
  console.log('[Seeder] Creating sample sales ledger transactions...');
  const prod1 = await db.collection('products').findOne({ sku: 'ANW-LWN-001' });
  const prod2 = await db.collection('products').findOne({ sku: 'ANW-CHF-002' });
  const prod3 = await db.collection('products').findOne({ sku: 'ANW-WHL-008' });
  const cust1 = await db.collection('customers').findOne({ phone: '03001234567' });
  const cust2 = await db.collection('customers').findOne({ phone: '03219876543' });

  // Sale 1 (Today): Retail
  const sale1 = {
    invoiceNumber: 'ANW-20260913-0001',
    date: new Date(),
    customerId: cust2 ? cust2._id : null,
    customerName: 'Begum Farzana Zafar (Boutique Elegance)',
    customerPhone: '03219876543',
    saleType: 'retail',
    items: [
      {
        productId: prod1._id,
        name: prod1.name,
        sku: prod1.sku,
        quantity: 2,
        unitPrice: 3950,
        unitCost: prod1.costPrice,
        discount: 0,
        lineTotal: 7900,
        lineCost: 2 * prod1.costPrice,
        lineProfit: 7900 - (2 * prod1.costPrice)
      },
      {
        productId: prod2._id,
        name: prod2.name,
        sku: prod2.sku,
        quantity: 1,
        unitPrice: 8900,
        unitCost: prod2.costPrice,
        discount: 400,
        lineTotal: 8500,
        lineCost: prod2.costPrice,
        lineProfit: 8500 - prod2.costPrice
      }
    ],
    grossTotal: 16800,
    subtotal: 16800,
    discount: 400,
    total: 16400,
    totalCost: (2 * prod1.costPrice) + prod2.costPrice, // 5600 + 5200 = 10800
    grossProfit: 16400 - 10800, // 5600
    paymentMethod: 'Bank',
    amountPaid: 16400,
    balanceDue: 0,
    paymentStatus: 'Paid',
    notes: 'Walk-in boutique collection purchase',
    createdBy: 'kamran',
    status: 'completed',
    isDemo: true,
    createdAt: new Date()
  };

  await db.collection('sales').updateOne(
    { invoiceNumber: sale1.invoiceNumber },
    { $set: sale1 },
    { upsert: true }
  );

  // Sale 2 (Today): Wholesale on partial credit
  const sale2 = {
    invoiceNumber: 'ANW-20260913-0002',
    date: new Date(),
    customerId: cust1 ? cust1._id : null,
    customerName: 'Haji Abdul Rehman (Al-Haram Fabrics, Faisalabad)',
    customerPhone: '03001234567',
    saleType: 'wholesale',
    items: [
      {
        productId: prod3._id,
        name: prod3.name,
        sku: prod3.sku,
        quantity: 2,
        unitPrice: 25500,
        unitCost: prod3.costPrice,
        discount: 1000,
        lineTotal: 50000,
        lineCost: 2 * prod3.costPrice, // 44000
        lineProfit: 6000
      }
    ],
    grossTotal: 51000,
    subtotal: 51000,
    discount: 1000,
    total: 50000,
    totalCost: 44000,
    grossProfit: 6000,
    paymentMethod: 'Credit',
    amountPaid: 20000,
    balanceDue: 30000,
    paymentStatus: 'Partial',
    notes: 'Cargo booked via Faisal Movers to Faisalabad. Rs. 20,000 cash advance received.',
    createdBy: 'admin',
    status: 'completed',
    isDemo: true,
    createdAt: new Date()
  };

  await db.collection('sales').updateOne(
    { invoiceNumber: sale2.invoiceNumber },
    { $set: sale2 },
    { upsert: true }
  );

  // 7. Seed Operating Expenses
  console.log('[Seeder] Creating realistic shop expenses...');
  const expenses = [
    {
      date: new Date(),
      category: 'Shop Rent',
      description: 'Monthly shop rent for Shop # M101/1, Iqbal Cloth Market',
      amount: 45000,
      paymentMethod: 'Bank',
      paidBy: 'Yousuf Mohsin',
      isDemo: true,
      createdAt: new Date()
    },
    {
      date: new Date(),
      category: 'Freight/Cargo',
      description: 'Cargo booking charges from Faisalabad Mills to Karachi godown',
      amount: 4200,
      paymentMethod: 'Cash',
      paidBy: 'Kamran',
      isDemo: true,
      createdAt: new Date()
    },
    {
      date: new Date(),
      category: 'Electricity',
      description: 'K-Electric commercial shop bill payment',
      amount: 12500,
      paymentMethod: 'JazzCash',
      paidBy: 'Yousuf Mohsin',
      isDemo: true,
      createdAt: new Date()
    },
    {
      date: new Date(),
      category: 'Refreshments',
      description: 'Daily tea & customer refreshments for wholesale buyers',
      amount: 850,
      paymentMethod: 'Cash',
      paidBy: 'Kamran',
      isDemo: true,
      createdAt: new Date()
    }
  ];

  for (const exp of expenses) {
    await db.collection('expenses').insertOne(exp);
  }

  // 8. Seed Announcements
  console.log('[Seeder] Creating announcement bar notices...');
  const announcements = [
    { text: '✨ Free Delivery Nationwide on Retail Orders Over Rs. 5,000 across Pakistan', active: true, sortOrder: 1 },
    { text: '🧵 Wholesale Inquiries & Master Bundles Welcome — Direct WhatsApp: 03363925950', active: true, sortOrder: 2 },
    { text: '📍 Visit Our Wholesale & Retail Outlet: Shop # M101/1, Iqbal Cloth Market, M.A Jinnah Road, Karachi', active: true, sortOrder: 3 },
    { text: '💎 Summer Festive Unstitched Lawn & Chiffon 2026 Collection Now In Stock!', active: true, sortOrder: 4 }
  ];

  await db.collection('announcements').deleteMany({});
  await db.collection('announcements').insertMany(announcements);

  // 9. Seed Hero Slides
  console.log('[Seeder] Creating luxury hero carousel slides...');
  const heroSlides = [
    {
      heading: 'THE ART OF FINE FABRICS',
      subheading: 'Exquisite unstitched luxury lawn, festive chiffon, and pure cotton collections curated for the discerning woman.',
      buttonText: 'EXPLORE COLLECTION',
      buttonUrl: '#collection',
      badge: 'NEW ARRIVALS 2026',
      image: '',
      active: true,
      sortOrder: 1,
      createdAt: new Date()
    },
    {
      heading: 'DIRECT FACTORY WHOLESALE',
      subheading: 'Wholesale unstitched suit bundles and master thaans for boutiques and retailers across Pakistan at direct market rates.',
      buttonText: 'WHOLESALE INQUIRY',
      buttonUrl: 'https://wa.me/923363925950?text=Assalam-o-Alaikum%20Al%20Anwar%20Cloth!%20I%20am%20interested%20in%20wholesale%20rates',
      badge: 'KARACHI WHOLESALE MARKET',
      image: '',
      active: true,
      sortOrder: 2,
      createdAt: new Date()
    },
    {
      heading: 'EXCLUSIVE FESTIVE CHIFFON',
      subheading: 'Intricate embroidery with hand-worked sequins and organza cutwork dupattas for upcoming weddings and eid celebrations.',
      buttonText: 'SHOP FESTIVE',
      buttonUrl: '#collection',
      badge: 'HANDCRAFTED LUXURY',
      image: '',
      active: true,
      sortOrder: 3,
      createdAt: new Date()
    }
  ];

  await db.collection('hero_slides').deleteMany({});
  await db.collection('hero_slides').insertMany(heroSlides);

  // 10. Seed CMS Store Settings
  console.log('[Seeder] Setting up store settings...');
  await db.collection('settings').updateOne(
    { key: 'store_settings' },
    {
      $set: {
        key: 'store_settings',
        value: {
          name: 'AL ANWAR FABRICS & CLOTH',
          tagline: 'Wholesale & Retail Unstitched Luxury Suits',
          address: 'M.A. Jinnah Road, Iqbal Cloth Market, Shop # M101/1, Karachi, Pakistan',
          phone: '03363925950',
          whatsapp: '+923363925950',
          email: 'info@alanwarcloth.com',
          freeDeliveryThreshold: 5000,
          currency: 'PKR',
          currencySymbol: 'Rs.'
        },
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );

  console.log('====================================================');
  console.log('  DATABASE SEEDED SUCCESSFULLY WITH DEMO DATA!');
  console.log('  Admin Login:');
  console.log('    Username: admin');
  console.log('    Password: admin123');
  console.log('  Accountant Login:');
  console.log('    Username: accountant');
  console.log('    Password: acc123');
  console.log('  Sales Staff Login:');
  console.log('    Username: sales');
  console.log('    Password: sales123');
  console.log('  Inventory Manager Login:');
  console.log('    Username: inventory');
  console.log('    Password: inv123');
  console.log('====================================================');
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(err => {
    console.error('Seeding error:', err);
    process.exit(1);
  });
}

module.exports = seed;
