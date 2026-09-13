module.exports = {
  ROLES: {
    SUPER_ADMIN: 'super_admin',
    ACCOUNTANT: 'accountant',
    SALES_STAFF: 'sales_staff',
    INVENTORY_MANAGER: 'inventory_manager'
  },
  MOVEMENT_TYPES: {
    STOCK_IN: 'STOCK_IN',
    SALE: 'SALE',
    RETURN: 'RETURN',
    DAMAGE: 'DAMAGE',
    LOSS: 'LOSS',
    ADJUSTMENT: 'ADJUSTMENT',
    OPENING_STOCK: 'OPENING_STOCK'
  },
  PAYMENT_METHODS: ['Cash', 'Bank', 'JazzCash', 'EasyPaisa', 'Credit'],
  EXPENSE_CATEGORIES: [
    'Shop Rent',
    'Electricity',
    'Water',
    'Internet',
    'Staff Salary',
    'Freight/Cargo',
    'Packaging',
    'Maintenance',
    'Refreshments',
    'Transportation',
    'Marketing',
    'Miscellaneous'
  ],
  DEFAULT_CATEGORIES: [
    'New Arrivals',
    'Unstitched Lawn',
    'Luxury Chiffon',
    'Cotton',
    'Khaddar',
    'Jacquard',
    'Embroidered',
    'Winter Collection',
    'Wholesale',
    'Sale'
  ],
  SHOP_INFO: {
    name: 'AL ANWAR FABRICS & CLOTH',
    address: 'M.A. Jinnah Road, Iqbal Cloth Market, Shop # M101/1, Karachi, Pakistan',
    phone: '03363925950',
    whatsapp: '+923363925950',
    currency: 'PKR',
    currencySymbol: 'Rs.'
  }
};
