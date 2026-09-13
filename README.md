# AL ANWAR FABRICS & CLOTH
### Enterprise Luxury Storefront & Shop Accounting ERP System

A production-grade, full-stack web application built specifically for **AL ANWAR FABRICS & CLOTH** — a luxury Pakistani fabric retail and wholesale business located in Karachi.

- **Address:** M.A. Jinnah Road, Iqbal Cloth Market, Shop # M101/1, Karachi, Pakistan
- **WhatsApp / Helpline:** `03363925950` (`+923363925950`)
- **Currency:** Pakistani Rupee (`PKR` / `Rs.`)

---

## 1. System Features

### A. Luxury Customer Storefront (`/`)
- **Visual Aesthetic:** Inspired by high-end Pakistani haute couture (dark charcoal `#0d141e`, warm gold `#c5a059`, soft ivory `#faf8f5`, elegant serif typography).
- **Announcement Bar:** Rotating notices (e.g. Free delivery nationwide over Rs. 5,000, direct wholesale helpline).
- **Sticky Header:** Hamburger navigation, brand title, search, currency indicator, wishlist badge, slide-over shopping bag.
- **Hero Campaign Carousel:** High-impact fashion campaigns with unstitched collection tags and CTAs (*Shop Collection* & *Wholesale Inquiry*).
- **Curated Collections:** Unstitched Lawn, Luxury Chiffon, Pure Cotton, Khaddar, Zari Jacquard, and Wholesale Bundles.
- **Product Catalog (3:4 Portrait Cards):**
  - Styled with textile badges (👗, 🧵, 🪡, ✨, 💎, 🌸, 🧣, 📦).
  - Original price vs. Sale price in `Rs.`, plus wholesale bulk rate indicators.
  - Stock alerts (`Only X Left`, `In Stock`, `Sold Out`).
  - Hover actions: Quick View modal, Add to Bag, and Direct WhatsApp Order button.
- **Slide-Over Shopping Bag (Cart Drawer):**
  - Real-time subtotal, free delivery threshold calculation, delivery fee, and grand total.
  - **WhatsApp Checkout:** Generates a structured, pre-filled WhatsApp order message to `+923363925950` with itemized SKU, quantities, and pricing.
- **Quick View Modal:** Large textile frame, fabric details, stock status, and direct WhatsApp inquiry.
- **Shop Location & Contact:** Physical address, Google Maps link, and wholesale inquiry form.
- **Floating WhatsApp Button:** Direct chat pinned to the bottom-right corner.

---

### B. Enterprise ERP & Accountant Dashboard (`/admin`)
- **Role-Based Authentication (RBAC):**
  - 👑 **Super Admin / Owner:** Full access to all accounting, inventory, CMS, settings, and users.
  - 📊 **Chief Accountant:** Access to Sales, Expenses, Customers, Suppliers, Reports, P&L, and Cash Reconciliation.
  - 🛍️ **Sales Staff:** Access to Sales POS, customer accounts, product catalog, and WhatsApp orders.
  - 📦 **Inventory Manager:** Access to products, stock valuation, inventory movements, and purchases.
- **Shop Dashboard & Financial KPIs:**
  - Dynamic Date Filter: *Today*, *Yesterday*, *This Week*, *This Month*, *Custom Range*.
  - Live KPI cards: Today's Sales, Gross Profit, Operating Expenses, Net Profit, Inventory Valuation, Customer Receivables, Supplier Payables.
  - **Financial Formula Bar:** Demonstrates the accounting equation:
    $$\text{Revenue} - \text{COGS} = \text{Gross Profit}$$
    $$\text{Gross Profit} - \text{Operating Expenses} = \text{Net Profit}$$
- **Daily Sales Ledger & POS ("Hisaab Kitaab"):**
  - Retail vs. Wholesale sale selector.
  - Automatic inventory deduction via `inventory_movements`.
  - Payment methods: *Cash*, *Bank Transfer*, *JazzCash*, *EasyPaisa*, *Credit / Udhaar*.
  - Printable customer invoices with tax/business headers.
- **Bill Scanner & OCR ("Bill Ki Photo Se Hisaab"):**
  - Upload bill photo or capture via camera.
  - Optical character recognition via Tesseract.js.
  - **Verification Step:** Displays an editable preview table where the user reviews/corrects item names, quantities, rates, and totals before committing to the database.
- **Purchases & Stock-In:**
  - Logs shipments from textile mills.
  - Automatically increases product stock, updates cost price, and updates supplier payables.
- **Inventory Management & Movements:**
  - Tracks movements: `STOCK_IN`, `SALE`, `RETURN`, `DAMAGE`, `LOSS`, `ADJUSTMENT`, `OPENING_STOCK`.
  - Stock valuation: Total Units, Total Cost Value, Total Retail Value, and Expected Profit.
  - Configurable low-stock alert thresholds.
- **Customer Ledger (Udhaar Tracker):**
  - Tracks purchases, payments, and outstanding balances.
  - Printable customer account statements with running balances.
  - Cash receipt modal that reduces customer outstanding balance.
- **Supplier / Mill Ledger:**
  - Tracks purchases, mill payments, and outstanding payables.
- **Operating Expenses Tracker:**
  - Categorized expenses: *Shop Rent*, *Electricity*, *Water*, *Internet*, *Staff Salary*, *Freight/Cargo*, *Packaging*, *Refreshments*, *Transportation*, *Miscellaneous*.
- **Profit & Loss (P&L) Statement:**
  - Itemized financial statement displaying Revenue, Discounts, Net Sales, COGS, Gross Profit, Operating Expenses, and Net Profit, with Gross/Net Margins %.
- **Cash & Bank Reconciliation:**
  - Separate balances for *Cash*, *Bank*, *JazzCash*, and *EasyPaisa*.
  - Compares expected balance (Opening + Inflows - Outflows) with actual entered balance, highlighting surpluses or deficits.
- **Sales Returns Module:**
  - Restocks returned units, reverses revenue and COGS, and adjusts customer balance.
- **Report Center (One-Click CSV Export):**
  - Downloadable CSVs and print views for:
    1. Sales Ledger Report
    2. Stock & Valuation Report
    3. Operating Expenses Report
    4. Profit & Loss Income Statement
    5. Customer Outstanding (Udhaar) Report
    6. Supplier Payables Report
- **Website CMS:**
  - Edit announcement bar text, hero banner headlines, store address, and phone numbers without modifying source code.

---

## 2. Technology Stack

- **Backend:** Node.js & Express.js (Single source of truth)
- **Database:** MongoDB Atlas (`al_anwar_db`) via official `mongodb` driver with DNS fallback for Windows
- **Security:** JWT authentication, `bcryptjs` password hashing, `helmet` security headers, `cors`, `express-rate-limit` brute-force protection
- **File Uploads:** `multer` for image storage in `public/uploads/`
- **OCR Engine:** `Tesseract.js` + Pakistani receipt pattern parser
- **Frontend:** Vanilla HTML5, CSS3 (Bespoke Luxury Design System), Modern Vanilla JavaScript

---

## 3. Quick Start & Installation

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (Node Package Manager)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Environment Variables
Create a `.env` file in the project root (see `.env.example`):
```env
PORT=5000
MONGODB_URI=mongodb+srv://yousufmohsin52_db_user:ZqZ6cP0Wyjk8GOej@cluster0.khoadig.mongodb.net/?appName=Cluster0
DB_NAME=al_anwar_db
JWT_SECRET=al_anwar_luxury_fabrics_super_secret_jwt_key_2026_iqbal_cloth_m101
SESSION_SECRET=al_anwar_session_secret_key_923363925950_m101
WHATSAPP_NUMBER=+923363925950
UPLOAD_DIR=public/uploads
NODE_ENV=development
```

### Step 3: Seed Database (Demo Data)
Populates users, categories, products, customer accounts, suppliers, and sales:
```bash
npm run seed
```

### Step 4: Run Automated Tests
Verifies accounting formulas ($\text{Revenue} - \text{COGS} - \text{Expenses} = \text{Net Profit}$) and inventory movement accuracy:
```bash
npm test
```

### Step 5: Start Application
```bash
npm start
```
- **Storefront:** [http://localhost:5000](http://localhost:5000)
- **Admin ERP:** [http://localhost:5000/admin](http://localhost:5000/admin)

---

## 4. Default Staff & Admin Credentials

| Role | Username | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Owner / Super Admin** | `admin` | `admin123` | Full access (ERP, Accounting, CMS, Settings, Users) |
| **Chief Accountant** | `accountant` | `acc123` | Sales, Expenses, Ledgers, P&L, Reconciliation, Reports |
| **Sales Staff** | `sales` | `sales123` | Sales POS, Customers, Catalog lookup, WhatsApp orders |
| **Inventory Manager** | `inventory` | `inv123` | Products, Stock adjustments, Purchases, Movements |

---

## 5. API Overview

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Staff & Admin authentication | Public (Rate-limited) |
| `GET` | `/api/auth/me` | Current user profile | Bearer Token |
| `GET` | `/api/products` | Public catalog with filters | Public |
| `POST` | `/api/products` | Create new fabric product | Super Admin, Inventory |
| `GET` | `/api/categories` | Fabric categories | Public |
| `GET` | `/api/sales` | Daily sales ledger | Authenticated Staff |
| `POST` | `/api/sales` | Create sale (reduces stock) | Super Admin, Accountant, Sales |
| `GET` | `/api/purchases` | Mill purchases (Stock-In) | Super Admin, Inventory, Accountant |
| `POST` | `/api/purchases` | Record purchase & increase stock | Super Admin, Inventory, Accountant |
| `GET` | `/api/inventory/movements` | Stock movement audit history | Authenticated Staff |
| `GET` | `/api/inventory/valuation` | Inventory cost & retail valuation | Authenticated Staff |
| `POST` | `/api/inventory/adjustments`| Manual stock correction / damage | Super Admin, Inventory |
| `GET` | `/api/customers` | Customer Udhaar list | Authenticated Staff |
| `POST` | `/api/customers/:id/payments`| Record customer payment | Super Admin, Accountant, Sales |
| `GET` | `/api/suppliers` | Textile mills payables list | Authenticated Staff |
| `GET` | `/api/expenses` | Operating expenses ledger | Super Admin, Accountant |
| `POST` | `/api/expenses` | Log shop expense | Super Admin, Accountant |
| `GET` | `/api/reconciliation` | Cash/Bank daily balances | Super Admin, Accountant |
| `POST` | `/api/ocr/parse-bill` | Parse bill photo with OCR | Authenticated Staff |
| `GET` | `/api/reports/dashboard` | Executive KPI cards summary | Authenticated Staff |
| `GET` | `/api/reports/download` | Export CSV & print data | Super Admin, Accountant |
| `GET` | `/api/cms/public` | Banners, announcements, settings | Public |

---

## 6. Business Address & Contacts

**AL ANWAR FABRICS & CLOTH**
- **Shop Address:** Shop # M101/1, Iqbal Cloth Market, M.A. Jinnah Road, Karachi, Pakistan
- **WhatsApp Line:** `03363925950`
- **International WhatsApp:** `+923363925950`
