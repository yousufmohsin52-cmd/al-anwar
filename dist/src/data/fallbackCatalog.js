/**
 * AL ANWAR FABRICS & CLOTH - Resilience Fallback Catalog
 * Ensures the storefront and product listings render instantly and gracefully on Vercel
 * even during serverless cold starts or when cloud IP network access is warming up.
 */

const FALLBACK_CATEGORIES = [
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

const FALLBACK_PRODUCTS = [
  {
    _id: '6aa6b9ff4274be717e691001',
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
    isArchived: false
  },
  {
    _id: '6aa6b9ff4274be717e691002',
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
    isArchived: false
  },
  {
    _id: '6aa6b9ff4274be717e691003',
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
    isArchived: false
  },
  {
    _id: '6aa6b9ff4274be717e691004',
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
    isArchived: false
  },
  {
    _id: '6aa6b9ff4274be717e691005',
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
    isArchived: false
  },
  {
    _id: '6aa6b9ff4274be717e691006',
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
    isArchived: false
  },
  {
    _id: '6aa6b9ff4274be717e691007',
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
    isArchived: false
  },
  {
    _id: '6aa6b9ff4274be717e691008',
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
    stock: 12,
    lowStockThreshold: 3,
    badges: ['Wholesale Only', '10 Suits Bundle'],
    emojiIcon: '📦',
    featured: true,
    active: true,
    isArchived: false
  }
];

const FALLBACK_ANNOUNCEMENTS = [
  '✨ Free Delivery Nationwide on Orders Over Rs. 5,000 across Pakistan',
  '🧵 Wholesale Inquiries & Master Bundles Welcome — Direct WhatsApp: 03363925950',
  '💎 Exclusive Festive Chiffon & Unstitched Lawn Collections 2026 Live Now',
  '📍 Visit Us: Shop # M101/1, Iqbal Cloth Market, M.A. Jinnah Road, Karachi'
];

const FALLBACK_HERO_SLIDES = [
  {
    heading: 'THE ART OF FINE FABRICS',
    subheading: 'Exquisite Pakistani unstitched lawn, festive chiffon, and pure cotton ensembles direct from Karachi wholesale market.',
    badge: 'NEW FESTIVE 2026',
    buttonText: 'SHOP COLLECTION',
    buttonUrl: '#collection',
    sortOrder: 1,
    active: true
  },
  {
    heading: 'DIRECT FACTORY WHOLESALE',
    subheading: 'Wholesale unstitched suit bundles and master thaans for boutiques and retailers across Pakistan at direct market rates.',
    badge: 'KARACHI WHOLESALE MARKET',
    buttonText: 'WHOLESALE INQUIRY',
    buttonUrl: 'https://wa.me/923363925950',
    sortOrder: 2,
    active: true
  }
];

module.exports = {
  FALLBACK_CATEGORIES,
  FALLBACK_PRODUCTS,
  FALLBACK_ANNOUNCEMENTS,
  FALLBACK_HERO_SLIDES
};
