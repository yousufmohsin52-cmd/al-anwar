/**
 * AL ANWAR FABRICS & CLOTH - Enterprise ERP & Accounting Engine
 * Production JavaScript Controller
 */

const ADMIN_STATE = {
  token: localStorage.getItem('al_anwar_token'),
  user: JSON.parse(localStorage.getItem('al_anwar_user') || 'null'),
  currentTab: 'dashboard',
  currentPeriod: 'today',
  products: [],
  categories: [],
  sales: [],
  purchases: [],
  expenses: [],
  customers: [],
  suppliers: [],
  movements: [],
  activePeriodDates: { startDate: null, endDate: null }
};

window.ADMIN_STATE = ADMIN_STATE;

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  if (!ADMIN_STATE.token || !ADMIN_STATE.user) {
    showLoginModal(true);
  } else {
    showLoginModal(false);
    setupUserProfile();
    enforceRolePermissions();
    await loadInitialData();
  }
});

// ==========================================================================
// 1. AUTHENTICATION & ROLE MANAGEMENT
// ==========================================================================
function showLoginModal(show) {
  const modal = document.getElementById('loginModal');
  if (modal) modal.style.display = show ? 'flex' : 'none';
}

window.handleLogin = async function(e) {
  if (e) e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (data.success && data.token) {
      ADMIN_STATE.token = data.token;
      ADMIN_STATE.user = data.user;
      localStorage.setItem('al_anwar_token', data.token);
      localStorage.setItem('al_anwar_user', JSON.stringify(data.user));

      showLoginModal(false);
      setupUserProfile();
      enforceRolePermissions();
      await loadInitialData();
    } else {
      if (errorEl) {
        errorEl.textContent = data.message || 'Invalid credentials.';
        errorEl.style.display = 'block';
      }
    }
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = 'Server connection error. Please try again.';
      errorEl.style.display = 'block';
    }
  }
};

window.fillDemoCredentials = function(username, password) {
  document.getElementById('loginUsername').value = username;
  document.getElementById('loginPassword').value = password;
  handleLogin();
};

window.handleLogout = function() {
  localStorage.removeItem('al_anwar_token');
  localStorage.removeItem('al_anwar_user');
  ADMIN_STATE.token = null;
  ADMIN_STATE.user = null;
  window.location.reload();
};

function setupUserProfile() {
  const nameEl = document.getElementById('topbarUserName');
  const roleEl = document.getElementById('topbarUserRole');
  const avatarEl = document.getElementById('topbarUserAvatar');

  if (ADMIN_STATE.user) {
    if (nameEl) nameEl.textContent = ADMIN_STATE.user.fullName || ADMIN_STATE.user.username;
    if (roleEl) roleEl.textContent = formatRole(ADMIN_STATE.user.role);
    if (avatarEl) avatarEl.textContent = (ADMIN_STATE.user.fullName || ADMIN_STATE.user.username).charAt(0).toUpperCase();
  }
}

function formatRole(role) {
  switch (role) {
    case 'super_admin': return 'Owner / Super Admin';
    case 'accountant': return 'Chief Accountant';
    case 'sales_staff': return 'Sales Staff';
    case 'inventory_manager': return 'Inventory Manager';
    default: return role;
  }
}

function enforceRolePermissions() {
  const role = ADMIN_STATE.user ? ADMIN_STATE.user.role : '';

  // Role permissions rules:
  // Accountant: Sales, Expenses, Customers, Suppliers, Reports, P&L, Reconciliation. No CMS settings or product deletion.
  // Sales Staff: Sales, Customers, Product Lookup.
  // Inventory Manager: Products, Inventory Movements, Stock Valuation, Purchases.
  const allNavBtns = document.querySelectorAll('.nav-item-btn');
  allNavBtns.forEach(btn => {
    const tab = btn.getAttribute('data-tab');
    if (!tab) return;

    let allowed = true;
    if (role === 'sales_staff') {
      if (!['dashboard', 'sales', 'ocr', 'customers', 'products'].includes(tab)) allowed = false;
    } else if (role === 'inventory_manager') {
      if (!['dashboard', 'products', 'inventory', 'purchases', 'suppliers'].includes(tab)) allowed = false;
    } else if (role === 'accountant') {
      if (['cms', 'users', 'audit'].includes(tab)) allowed = false;
    }

    btn.style.display = allowed ? 'flex' : 'none';
  });
}

// API Helper with Auth Header
async function fetchAPI(endpoint, options = {}) {
  const headers = options.headers || {};
  if (ADMIN_STATE.token) {
    headers['Authorization'] = `Bearer ${ADMIN_STATE.token}`;
  }
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(endpoint, { ...options, headers });
  if (res.status === 401) {
    handleLogout();
    throw new Error('Session expired');
  }
  return res.json();
}

// Universal In-Page Toast Notification (unblockable by browser)
window.showToast = function(msg, type = 'success') {
  let container = document.getElementById('erpToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'erpToastContainer';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:90vw;width:380px;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bg = type === 'error' ? '#c92a2a' : (type === 'warning' ? '#d97706' : '#1e3a2b');
  const border = type === 'error' ? '#ff6b6b' : (type === 'warning' ? '#fbbf24' : '#c5a059');
  
  toast.style.cssText = `background:${bg};color:#fff;border-left:4px solid ${border};border-radius:6px;padding:12px 16px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-size:0.88rem;display:flex;align-items:center;justify-content:space-between;pointer-events:auto;animation:fadeIn 0.2s ease;`;
  toast.innerHTML = `<span style="flex:1;">${escapeHTML(msg)}</span><button type="button" style="background:none;border:none;color:#fff;font-size:1.1rem;margin-left:12px;cursor:pointer;opacity:0.8;" onclick="this.parentElement.remove()">✕</button>`;
  
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 4500);
};

// Universal In-Modal Confirmation (Never suppressed or blocked by Chrome/mobile)
window.showConfirmDialog = function({ title, message, details, confirmText = 'Yes, Proceed', confirmColor = '#c92a2a', onConfirm }) {
  const modal = document.getElementById('customConfirmModal');
  if (!modal) {
    if (window.confirm(message || 'Are you sure?')) {
      if (typeof onConfirm === 'function') onConfirm();
    }
    return;
  }
  
  const titleEl = document.getElementById('customConfirmTitle');
  const msgEl = document.getElementById('customConfirmMessage');
  const detEl = document.getElementById('customConfirmDetails');
  const actionBtn = document.getElementById('btnCustomConfirmAction');

  if (titleEl) titleEl.textContent = title || 'Confirm Action';
  if (msgEl) msgEl.innerHTML = message || 'Are you sure you want to proceed?';
  if (detEl) {
    if (details) {
      detEl.textContent = details;
      detEl.style.display = 'block';
    } else {
      detEl.style.display = 'none';
    }
  }

  if (actionBtn) {
    actionBtn.textContent = confirmText;
    actionBtn.style.background = confirmColor;
    actionBtn.disabled = false;
    actionBtn.onclick = async function() {
      actionBtn.disabled = true;
      actionBtn.textContent = 'Processing...';
      try {
        if (typeof onConfirm === 'function') {
          await onConfirm();
        }
      } catch (err) {
        console.error('Confirm action error:', err);
        showToast(err.message, 'error');
      } finally {
        actionBtn.disabled = false;
        actionBtn.textContent = confirmText;
        closeModal('customConfirmModal');
      }
    };
  }

  modal.classList.add('active');
};

window.toggleAdminSidebar = function(show) {
  const sidebar = document.querySelector('.erp-sidebar');
  const overlay = document.getElementById('adminSidebarOverlay');
  if (!sidebar) return;

  const isActive = sidebar.classList.contains('mobile-open');
  const target = show !== undefined ? show : !isActive;

  sidebar.classList.toggle('mobile-open', target);
  if (overlay) overlay.classList.toggle('active', target);
  document.body.style.overflow = target ? 'hidden' : '';
};

// ==========================================================================
// 2. TAB NAVIGATION & INITIAL DATA
// ==========================================================================
window.switchTab = function(tabName) {
  ADMIN_STATE.currentTab = tabName;

  document.querySelectorAll('.nav-item-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });

  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.toggle('active', tab.id === `tab-${tabName}`);
  });

  // Auto-close drawer on mobile when tab is selected
  if (window.innerWidth <= 768) {
    toggleAdminSidebar(false);
  }

  const titles = {
    dashboard: 'Shop Overview & Hisaab Kitaab',
    sales: 'Daily Sales Ledger & POS',
    ocr: 'Bill Scanner / OCR ("Bill Ki Photo Se Hisab")',
    purchases: 'Purchases & Stock-In (Mills)',
    inventory: 'Inventory Valuation & Movements',
    customers: 'Customer Accounts & Udhaar Ledger',
    suppliers: 'Supplier & Mill Payables Ledger',
    expenses: 'Shop Operating Expenses',
    pl: 'Profit & Loss (P&L) Income Statement',
    reconciliation: 'Cash & Bank Reconciliation',
    returns: 'Customer Sales Returns',
    reports: 'Enterprise Report Center',
    products: 'Product & Fabric Catalog',
    cms: 'Website CMS & Hero Banners',
    audit: 'System Audit Logs'
  };

  const titleEl = document.getElementById('activePageTitle');
  if (titleEl) titleEl.textContent = titles[tabName] || 'ERP Management';

  // Load specific tab data
  switch (tabName) {
    case 'dashboard': loadDashboardStats(); break;
    case 'sales': loadSales(); break;
    case 'purchases': loadPurchases(); break;
    case 'inventory': loadInventory(); break;
    case 'customers': loadCustomers(); break;
    case 'suppliers': loadSuppliers(); break;
    case 'expenses': loadExpenses(); break;
    case 'pl': loadProfitLoss(); break;
    case 'reconciliation': loadReconciliation(); break;
    case 'returns': loadReturns(); break;
    case 'reports': loadReportPreview(); break;
    case 'products': loadAdminProducts(); break;
    case 'cms': loadCMSAdmin(); break;
    case 'audit': loadAuditLogs(); break;
  }
};

async function loadInitialData() {
  await loadProductsCatalog();
  await loadDashboardStats();
  switchTab('dashboard');
}

async function loadProductsCatalog() {
  try {
    const data = await fetchAPI('/api/products/admin/all');
    if (data.success && data.products) {
      ADMIN_STATE.products = data.products;
    }
  } catch (err) {
    console.error('Error loading products:', err);
  }
}

// ==========================================================================
// 3. DASHBOARD TAB & FINANCIAL KPIS
// ==========================================================================
window.setDashboardPeriod = function(period) {
  ADMIN_STATE.currentPeriod = period;
  document.querySelectorAll('.date-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-period') === period);
  });
  loadDashboardStats();
};

async function loadDashboardStats() {
  try {
    const data = await fetchAPI('/api/reports/dashboard');
    if (!data.success) return;

    const today = data.today;
    const month = data.thisMonth;
    const inv = data.inventory;
    const ledgers = data.ledgers;

    // KPI 1: Today's Sales
    document.getElementById('kpiTodaySales').textContent = `Rs. ${formatPKR(today.sales)}`;
    document.getElementById('kpiTodaySalesCount').textContent = `${today.salesCount} Invoices generated today`;

    // KPI 2: Today's Gross Profit (Revenue - COGS)
    document.getElementById('kpiTodayGrossProfit').textContent = `Rs. ${formatPKR(today.grossProfit)}`;
    document.getElementById('kpiTodayGrossMargin').textContent = `Gross Margin: ${today.grossMargin}%`;

    // KPI 3: Today's Operating Expenses
    document.getElementById('kpiTodayExpenses').textContent = `Rs. ${formatPKR(today.expenses)}`;

    // KPI 4: Today's Net Profit (Gross Profit - Expenses)
    const netProfitEl = document.getElementById('kpiTodayNetProfit');
    netProfitEl.textContent = `Rs. ${formatPKR(today.netProfit)}`;
    netProfitEl.style.color = today.netProfit >= 0 ? '#2b8a3e' : '#c92a2a';
    document.getElementById('kpiTodayNetMargin').textContent = `Net Margin: ${today.netMargin}%`;

    // Formula Banner Updates
    document.getElementById('formulaRevenue').textContent = `Rs. ${formatPKR(today.sales)}`;
    document.getElementById('formulaCogs').textContent = `Rs. ${formatPKR(today.cogs)}`;
    document.getElementById('formulaGross').textContent = `Rs. ${formatPKR(today.grossProfit)}`;
    document.getElementById('formulaExpenses').textContent = `Rs. ${formatPKR(today.expenses)}`;
    document.getElementById('formulaNet').textContent = `Rs. ${formatPKR(today.netProfit)}`;

    // Monthly & Balance Overview
    document.getElementById('kpiMonthSales').textContent = `Rs. ${formatPKR(month.sales)}`;
    document.getElementById('kpiMonthNetProfit').textContent = `Rs. ${formatPKR(month.netProfit)}`;
    document.getElementById('kpiInventoryValuation').textContent = `Rs. ${formatPKR(inv.totalCostValue)}`;
    document.getElementById('kpiTotalStockUnits').textContent = `${inv.totalUnits} Suits (${inv.lowStockCount} Low Stock)`;
    document.getElementById('kpiReceivables').textContent = `Rs. ${formatPKR(ledgers.customerReceivables)}`;
    document.getElementById('kpiPayables').textContent = `Rs. ${formatPKR(ledgers.supplierPayables)}`;

    // Load recent transactions on dashboard
    loadRecentSalesWidget();
  } catch (err) {
    console.error('Error loading dashboard stats:', err);
  }
}

async function loadRecentSalesWidget() {
  const tbody = document.getElementById('dashboardRecentSalesBody');
  if (!tbody) return;

  try {
    const data = await fetchAPI('/api/sales?limit=6');
    if (data.success && data.sales) {
      if (data.sales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--erp-muted);">No sales recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.sales.map(s => `
        <tr>
          <td><strong>#${s.invoiceNumber}</strong></td>
          <td>${new Date(s.date).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${escapeHTML(s.customerName || 'Walk-in Customer')}</td>
          <td>${(s.items || []).length} items</td>
          <td style="font-weight:700;">Rs. ${formatPKR(s.total)}</td>
          <td><span class="badge-status ${s.paymentStatus.toLowerCase()}">${s.paymentStatus} (${s.paymentMethod})</span></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

// ==========================================================================
// 4. SALES LEDGER & POS
// ==========================================================================
async function loadSales() {
  const tbody = document.getElementById('salesTableBody');
  if (!tbody) return;

  try {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;">Loading sales ledger...</td></tr>`;
    const search = document.getElementById('saleSearchInput') ? document.getElementById('saleSearchInput').value : '';
    const payment = document.getElementById('salePaymentFilter') ? document.getElementById('salePaymentFilter').value : '';

    let url = `/api/sales?limit=100`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (payment && payment !== 'All') url += `&paymentMethod=${encodeURIComponent(payment)}`;

    const data = await fetchAPI(url);
    if (data.success && data.sales) {
      ADMIN_STATE.sales = data.sales;
      if (data.sales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--erp-muted);">No sales found.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.sales.map(s => {
        const profit = Number(s.total || 0) - Number(s.totalCost || 0);
        return `
          <tr>
            <td><strong>#${s.invoiceNumber}</strong></td>
            <td>${new Date(s.date).toLocaleDateString('en-PK')}</td>
            <td>
              <div><strong>${escapeHTML(s.customerName || 'Walk-in Customer')}</strong></div>
              ${s.customerPhone ? `<div style="font-size:0.75rem;color:var(--erp-muted);">${s.customerPhone}</div>` : ''}
            </td>
            <td><span class="badge-status ${s.saleType === 'wholesale' ? 'partial' : 'in_stock'}">${s.saleType}</span></td>
            <td>${(s.items || []).map(i => `${i.name} (x${i.quantity})`).join(', ')}</td>
            <td style="font-weight:700;">Rs. ${formatPKR(s.total)}</td>
            <td style="color:#2b8a3e;font-weight:600;">Rs. ${formatPKR(profit)}</td>
            <td><span class="badge-status ${s.paymentStatus.toLowerCase()}">${s.paymentStatus} (${s.paymentMethod})</span></td>
            <td>
              <div style="display:flex; gap:4px;">
                <button class="btn-erp-outline" style="padding:4px 8px;font-size:0.75rem;" onclick="printInvoice('${s._id}')">🖨️ Bill</button>
                ${s.status === 'cancelled'
                  ? `<span class="badge-status out_of_stock" style="font-size:0.7rem; padding:3px 6px;">Cancelled</span>`
                  : `<button class="btn-erp-outline" style="padding:4px 8px;font-size:0.75rem;color:#c92a2a;border-color:#c92a2a;" onclick="cancelSaleAction('${s._id}')" title="Cancel sale & restock">🚫 Cancel</button>`
                }
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error loading sales:', err);
  }
}

window.cancelSaleAction = function(saleId) {
  showConfirmDialog({
    title: '⚠️ Cancel Sale & Restock',
    message: 'Are you sure you want to cancel this sale? Sold stock will be automatically returned back to inventory.',
    confirmText: 'Yes, Cancel Sale',
    confirmColor: '#c92a2a',
    onConfirm: async () => {
      const res = await fetchAPI(`/api/sales/${saleId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Admin cancelled sale & restocked' })
      });
      if (res && res.success) {
        showToast('✓ Sale cancelled and items restocked successfully.', 'success');
        loadSales();
        loadDashboardStats();
        loadProductsCatalog();
      } else {
        showToast(`Error: ${(res && res.message) || 'Failed to cancel sale'}`, 'error');
      }
    }
  });
};

window.openNewSaleModal = function() {
  const modal = document.getElementById('newSaleModal');
  if (!modal) return;

  // Populate product dropdown
  const prodSelect = document.getElementById('saleProductSelect');
  if (prodSelect) {
    prodSelect.innerHTML = `<option value="">-- Choose Fabric / Suit --</option>` +
      ADMIN_STATE.products.map(p => `
        <option value="${p._id}" data-cost="${p.costPrice}" data-retail="${p.retailPrice}" data-wholesale="${p.wholesalePrice}" data-stock="${p.stock}">
          ${p.name} (SKU: ${p.sku}) - Stock: ${p.stock} - Rs. ${formatPKR(p.retailPrice)}
        </option>
      `).join('');
  }

  modal.classList.add('active');
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
};

window.handleSaleProductChange = function() {
  const select = document.getElementById('saleProductSelect');
  const opt = select.selectedOptions[0];
  if (!opt || !opt.value) return;

  const saleType = document.getElementById('newSaleType').value;
  const priceInput = document.getElementById('newSaleUnitPrice');

  const price = saleType === 'wholesale' ? opt.getAttribute('data-wholesale') : opt.getAttribute('data-retail');
  if (priceInput) priceInput.value = price;
  recalcNewSaleTotal();
};

window.recalcNewSaleTotal = function() {
  const qty = parseInt(document.getElementById('newSaleQty').value, 10) || 1;
  const rate = parseFloat(document.getElementById('newSaleUnitPrice').value) || 0;
  const discount = parseFloat(document.getElementById('newSaleDiscount').value) || 0;
  const total = Math.max(0, (qty * rate) - discount);

  const display = document.getElementById('newSaleTotalDisplay');
  if (display) display.textContent = `Rs. ${formatPKR(total)}`;

  const amountPaidInput = document.getElementById('newSaleAmountPaid');
  const payMethod = document.getElementById('newSalePaymentMethod').value;
  if (amountPaidInput && payMethod !== 'Credit') {
    amountPaidInput.value = total;
  }
};

window.submitNewSale = async function(e) {
  if (e) e.preventDefault();
  const select = document.getElementById('saleProductSelect');
  const productId = select.value;
  if (!productId) {
    alert('Please select a fabric/suit.');
    return;
  }

  const qty = parseInt(document.getElementById('newSaleQty').value, 10) || 1;
  const unitPrice = parseFloat(document.getElementById('newSaleUnitPrice').value) || 0;
  const discount = parseFloat(document.getElementById('newSaleDiscount').value) || 0;
  const custName = document.getElementById('newSaleCustName').value.trim();
  const custPhone = document.getElementById('newSaleCustPhone').value.trim();
  const saleType = document.getElementById('newSaleType').value;
  const paymentMethod = document.getElementById('newSalePaymentMethod').value;
  const amountPaid = parseFloat(document.getElementById('newSaleAmountPaid').value) || 0;
  const notes = document.getElementById('newSaleNotes').value.trim();

  const payload = {
    customerName: custName || 'Walk-in Customer',
    customerPhone: custPhone,
    saleType,
    paymentMethod,
    amountPaid,
    discount,
    notes,
    items: [
      {
        productId,
        quantity: qty,
        unitPrice,
        discount: 0
      }
    ]
  };

  try {
    const res = await fetchAPI('/api/sales', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      alert(`✓ Sale Confirmed!\nInvoice: #${res.invoiceNumber}`);
      closeModal('newSaleModal');
      await loadProductsCatalog();
      loadSales();
      loadDashboardStats();
    } else {
      alert(`Error: ${res.message}`);
    }
  } catch (err) {
    alert(`Failed to save sale: ${err.message}`);
  }
};

window.printInvoice = function(saleId) {
  const sale = ADMIN_STATE.sales.find(s => s._id === saleId);
  if (!sale) return;

  const printWindow = window.open('', '_blank', 'width=700,height=800');
  const itemsHtml = (sale.items || []).map((i, idx) => `
    <tr>
      <td style="padding:6px;border-bottom:1px solid #ddd;">${idx + 1}</td>
      <td style="padding:6px;border-bottom:1px solid #ddd;"><strong>${i.name}</strong><br><small>SKU: ${i.sku || '-'}</small></td>
      <td style="padding:6px;border-bottom:1px solid #ddd;text-align:center;">${i.quantity}</td>
      <td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;">Rs. ${formatPKR(i.unitPrice)}</td>
      <td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;font-weight:700;">Rs. ${formatPKR(i.lineTotal || (i.quantity * i.unitPrice))}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <html>
    <head>
      <title>Invoice #${sale.invoiceNumber} - AL ANWAR FABRICS</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 24px; color: #121414; line-height: 1.4; }
        .header { text-align: center; border-bottom: 2px solid #0d141e; padding-bottom: 12px; margin-bottom: 16px; }
        .title { font-size: 24px; font-weight: bold; letter-spacing: 2px; }
        .sub { font-size: 11px; color: #555; text-transform: uppercase; }
        .meta-table { width: 100%; margin-bottom: 16px; font-size: 13px; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
        .items-table th { background: #0d141e; color: #fff; padding: 8px 6px; text-align: left; }
        .summary-box { float: right; width: 280px; font-size: 14px; }
        .summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
        .total-row { border-top: 2px solid #000; font-weight: bold; font-size: 16px; margin-top: 4px; padding-top: 4px; }
        .footer-note { text-align: center; margin-top: 60px; font-size: 11px; color: #777; border-top: 1px dashed #ccc; padding-top: 10px; clear: both; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">AL ANWAR FABRICS & CLOTH</div>
        <div class="sub">Wholesale & Retail Unstitched Luxury Suits</div>
        <div>M.A. Jinnah Road, Iqbal Cloth Market, Shop # M101/1, Karachi</div>
        <div>WhatsApp / Phone: 03363925950 (+923363925950)</div>
      </div>

      <table class="meta-table">
        <tr>
          <td><strong>Invoice #:</strong> ${sale.invoiceNumber}</td>
          <td style="text-align:right;"><strong>Date:</strong> ${new Date(sale.date).toLocaleDateString('en-PK')}</td>
        </tr>
        <tr>
          <td><strong>Customer:</strong> ${escapeHTML(sale.customerName || 'Walk-in Customer')}</td>
          <td style="text-align:right;"><strong>Payment:</strong> ${sale.paymentMethod} (${sale.paymentStatus})</td>
        </tr>
        ${sale.customerPhone ? `<tr><td><strong>Phone:</strong> ${sale.customerPhone}</td><td></td></tr>` : ''}
      </table>

      <table class="items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item Description</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Rate</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="summary-box">
        <div class="summary-row">
          <span>Subtotal:</span>
          <span>Rs. ${formatPKR(sale.subtotal || sale.total)}</span>
        </div>
        ${sale.discount > 0 ? `
          <div class="summary-row">
            <span>Discount:</span>
            <span>Rs. ${formatPKR(sale.discount)}</span>
          </div>
        ` : ''}
        <div class="summary-row total-row">
          <span>Grand Total:</span>
          <span>Rs. ${formatPKR(sale.total)}</span>
        </div>
        <div class="summary-row">
          <span>Amount Paid:</span>
          <span>Rs. ${formatPKR(sale.amountPaid || 0)}</span>
        </div>
        ${sale.balanceDue > 0 ? `
          <div class="summary-row" style="color:#c92a2a;font-weight:bold;">
            <span>Balance Due:</span>
            <span>Rs. ${formatPKR(sale.balanceDue)}</span>
          </div>
        ` : ''}
      </div>

      <div class="footer-note">
        Thank you for your business with AL ANWAR FABRICS & CLOTH!<br>
        Goods once sold can be exchanged within 7 days with original invoice.<br>
        Software generated receipt • Karachi, Pakistan
      </div>

      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

// ==========================================================================
// 5. PURCHASES / STOCK IN (MILLS)
// ==========================================================================
async function loadPurchases() {
  const tbody = document.getElementById('purchasesTableBody');
  if (!tbody) return;

  try {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;">Loading purchases...</td></tr>`;
    const data = await fetchAPI('/api/purchases?limit=50');
    if (data.success && data.purchases) {
      ADMIN_STATE.purchases = data.purchases;
      if (data.purchases.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--erp-muted);">No purchases logged yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.purchases.map(p => `
        <tr>
          <td><strong>#${p.purchaseNumber}</strong></td>
          <td>${new Date(p.date).toLocaleDateString('en-PK')}</td>
          <td><strong>${escapeHTML(p.supplierName)}</strong></td>
          <td>${(p.items || []).map(i => `${i.name} (${i.quantity} suits @ Rs. ${formatPKR(i.costPrice)})`).join('<br>')}</td>
          <td style="font-weight:700;">Rs. ${formatPKR(p.totalCost)}</td>
          <td>Rs. ${formatPKR(p.amountPaid)}</td>
          <td style="color:${p.remainingPayable > 0 ? '#c92a2a' : '#2b8a3e'};font-weight:600;">
            ${p.remainingPayable > 0 ? `Rs. ${formatPKR(p.remainingPayable)} (Due)` : 'Settled'}
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading purchases:', err);
  }
}

window.openNewPurchaseModal = function() {
  const modal = document.getElementById('newPurchaseModal');
  if (!modal) return;

  // Populate supplier select
  const supSelect = document.getElementById('purchaseSupplierSelect');
  if (supSelect) {
    supSelect.innerHTML = `<option value="">-- Choose Supplier / Mill --</option>` +
      ADMIN_STATE.suppliers.map(s => `<option value="${s._id}">${s.name} (${s.company || 'Mill'})</option>`).join('');
  }

  // Populate product select
  const prodSelect = document.getElementById('purchaseProductSelect');
  if (prodSelect) {
    prodSelect.innerHTML = `<option value="">-- Choose Fabric Item --</option>` +
      ADMIN_STATE.products.map(p => `<option value="${p._id}" data-cost="${p.costPrice}">${p.name} (Current Cost: Rs. ${formatPKR(p.costPrice)})</option>`).join('');
  }

  modal.classList.add('active');
};

window.handlePurchaseProductChange = function() {
  const select = document.getElementById('purchaseProductSelect');
  const opt = select.selectedOptions[0];
  if (!opt || !opt.value) return;
  const costInput = document.getElementById('purchaseCostPrice');
  if (costInput) costInput.value = opt.getAttribute('data-cost') || 0;
};

window.submitNewPurchase = async function(e) {
  if (e) e.preventDefault();
  const supplierId = document.getElementById('purchaseSupplierSelect').value;
  const productId = document.getElementById('purchaseProductSelect').value;
  const qty = parseInt(document.getElementById('purchaseQty').value, 10) || 1;
  const costPrice = parseFloat(document.getElementById('purchaseCostPrice').value) || 0;
  const amountPaid = parseFloat(document.getElementById('purchaseAmountPaid').value) || 0;
  const paymentMethod = document.getElementById('purchasePaymentMethod').value;
  const notes = document.getElementById('purchaseNotes').value.trim();

  if (!productId || qty <= 0) {
    alert('Please select a valid product and quantity.');
    return;
  }

  const payload = {
    supplierId: supplierId || null,
    supplierName: supplierId ? '' : 'Direct Fabric Mill',
    items: [{ productId, quantity: qty, costPrice }],
    paymentMethod,
    amountPaid,
    notes
  };

  try {
    const res = await fetchAPI('/api/purchases', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      alert(`✓ Stock-In Confirmed!\nPurchase #${res.purchase.purchaseNumber}\nInventory updated.`);
      closeModal('newPurchaseModal');
      await loadProductsCatalog();
      loadPurchases();
      loadDashboardStats();
    } else {
      alert(`Error: ${res.message}`);
    }
  } catch (err) {
    alert(`Failed to save purchase: ${err.message}`);
  }
};

// ==========================================================================
// 6. INVENTORY MOVEMENTS & VALUATION
// ==========================================================================
async function loadInventory() {
  try {
    // 1. Valuation KPIs
    const valData = await fetchAPI('/api/inventory/valuation');
    if (valData.success && valData.summary) {
      const s = valData.summary;
      document.getElementById('invTotalItems').textContent = s.totalItems;
      document.getElementById('invTotalUnits').textContent = `${s.totalUnits} Suits`;
      document.getElementById('invTotalCostVal').textContent = `Rs. ${formatPKR(s.totalCostValue)}`;
      document.getElementById('invTotalRetailVal').textContent = `Rs. ${formatPKR(s.totalRetailValue)}`;
      document.getElementById('invExpectedMargin').textContent = `Rs. ${formatPKR(s.expectedGrossProfit)}`;
    }

    // 2. Products table
    const prodTbody = document.getElementById('inventoryProductsTableBody');
    if (prodTbody) {
      prodTbody.innerHTML = ADMIN_STATE.products.map(p => {
        const costVal = (p.stock || 0) * (p.costPrice || 0);
        const retailVal = (p.stock || 0) * (p.retailPrice || 0);
        return `
          <tr>
            <td><strong>${p.name}</strong></td>
            <td><code>${p.sku}</code></td>
            <td>${p.category}</td>
            <td><strong style="font-size:1.05rem;">${p.stock}</strong></td>
            <td><span class="badge-status ${p.stockStatus}">${p.stockStatus.replace('_', ' ')}</span></td>
            <td>Rs. ${formatPKR(p.costPrice)}</td>
            <td>Rs. ${formatPKR(costVal)}</td>
            <td style="text-align:right;">
              <div style="display:inline-flex; gap:6px;">
                <button class="btn-erp-outline" style="padding:4px 8px;font-size:0.75rem;" onclick="openStockAdjustModal('${p._id}', '${escapeHTML(p.name)}')">📦 Adjust</button>
                <button class="btn-erp-outline" style="padding:4px 8px;font-size:0.75rem;" onclick="openEditProductModal('${p._id}')">✏️ Edit</button>
                <button class="btn-erp-outline" style="padding:4px 8px;font-size:0.75rem;color:#c92a2a;border-color:#c92a2a;" onclick="deleteProduct('${p._id}')">🗑️ Delete</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // 3. Movements log
    const moveTbody = document.getElementById('inventoryMovementsTableBody');
    if (moveTbody) {
      const moveData = await fetchAPI('/api/inventory/movements?limit=30');
      if (moveData.success && moveData.movements) {
        moveTbody.innerHTML = moveData.movements.map(m => `
          <tr>
            <td>${new Date(m.date).toLocaleDateString('en-PK')} ${new Date(m.date).toLocaleTimeString('en-PK', {hour:'2-digit',minute:'2-digit'})}</td>
            <td>${m.productName}</td>
            <td><span class="badge-status ${m.movementType.toLowerCase()}">${m.movementType}</span></td>
            <td style="font-weight:700;color:${m.stockChange > 0 ? '#2b8a3e' : '#c92a2a'}">${m.stockChange > 0 ? `+${m.stockChange}` : m.stockChange}</td>
            <td>${m.previousStock} → <strong>${m.newStock}</strong></td>
            <td>${escapeHTML(m.reference)}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading inventory:', err);
  }
}

window.openStockAdjustModal = function(productId, productName) {
  document.getElementById('adjustProductId').value = productId;
  document.getElementById('adjustProductName').textContent = productName;
  document.getElementById('adjustStockModal').classList.add('active');
};

window.submitStockAdjustment = async function(e) {
  if (e) e.preventDefault();
  const productId = document.getElementById('adjustProductId').value;
  const quantity = parseInt(document.getElementById('adjustQuantity').value, 10) || 0;
  const movementType = document.getElementById('adjustMovementType').value;
  const notes = document.getElementById('adjustNotes').value.trim();

  try {
    const res = await fetchAPI('/api/inventory/adjustments', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity, movementType, notes })
    });

    if (res.success) {
      alert('✓ Stock adjustment recorded successfully.');
      closeModal('adjustStockModal');
      await loadProductsCatalog();
      loadInventory();
      loadDashboardStats();
    } else {
      alert(`Error: ${res.message}`);
    }
  } catch (err) {
    alert(err.message);
  }
};

// ==========================================================================
// 7. CUSTOMER LEDGER & UDHAAR
// ==========================================================================
async function loadCustomers() {
  const tbody = document.getElementById('customersTableBody');
  if (!tbody) return;

  try {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;">Loading customer accounts...</td></tr>`;
    const search = document.getElementById('customerSearchInput') ? document.getElementById('customerSearchInput').value : '';
    let url = '/api/customers';
    if (search) url += `?search=${encodeURIComponent(search)}`;

    const data = await fetchAPI(url);
    if (data.success && data.customers) {
      ADMIN_STATE.customers = data.customers;
      tbody.innerHTML = data.customers.map(c => `
        <tr>
          <td><strong>${escapeHTML(c.name)}</strong></td>
          <td>${c.phone}</td>
          <td>${escapeHTML(c.address || '-')}</td>
          <td>Rs. ${formatPKR(c.totalPurchases)}</td>
          <td>Rs. ${formatPKR(c.totalPaid)}</td>
          <td style="font-weight:700;color:${c.outstandingBalance > 0 ? '#c92a2a' : '#2b8a3e'};">
            Rs. ${formatPKR(c.outstandingBalance)}
          </td>
          <td>
            <button class="btn-erp-outline" style="padding:4px 8px;font-size:0.75rem;" onclick="viewCustomerLedger('${c._id}')">Statement</button>
            <button class="btn-erp-gold" style="padding:4px 8px;font-size:0.75rem;" onclick="openCustomerPaymentModal('${c._id}', '${escapeHTML(c.name)}', ${c.outstandingBalance})">Receive Cash</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading customers:', err);
  }
}

window.viewCustomerLedger = async function(customerId) {
  try {
    const data = await fetchAPI(`/api/customers/${customerId}/ledger`);
    if (!data.success) return;

    const modal = document.getElementById('customerLedgerModal');
    const title = document.getElementById('ledgerCustomerTitle');
    const summary = document.getElementById('ledgerSummaryBox');
    const tbody = document.getElementById('ledgerTableBody');

    title.textContent = `${data.customer.name} (Phone: ${data.customer.phone})`;
    summary.innerHTML = `
      <div style="display:flex;gap:24px;background:var(--erp-bg);padding:14px;border-radius:var(--radius-sm);margin-bottom:16px;">
        <div><strong>Total Purchases:</strong> Rs. ${formatPKR(data.summary.totalPurchases)}</div>
        <div><strong>Total Paid:</strong> Rs. ${formatPKR(data.summary.totalPaid)}</div>
        <div style="color:#c92a2a;"><strong>Current Due:</strong> Rs. ${formatPKR(data.summary.currentBalance)}</div>
      </div>
    `;

    tbody.innerHTML = data.ledger.map(entry => `
      <tr>
        <td>${new Date(entry.date).toLocaleDateString('en-PK')}</td>
        <td><span class="badge-status ${entry.type.toLowerCase()}">${entry.type}</span></td>
        <td>${escapeHTML(entry.description)}</td>
        <td>${entry.debit > 0 ? `Rs. ${formatPKR(entry.debit)}` : '-'}</td>
        <td>${entry.credit > 0 ? `Rs. ${formatPKR(entry.credit)}` : '-'}</td>
        <td style="font-weight:700;">Rs. ${formatPKR(entry.balance)}</td>
      </tr>
    `).join('');

    modal.classList.add('active');
  } catch (err) {
    console.error(err);
  }
};

window.openCustomerPaymentModal = function(customerId, customerName, currentDue) {
  document.getElementById('payCustomerId').value = customerId;
  document.getElementById('payCustomerName').textContent = customerName;
  document.getElementById('payCustomerDue').textContent = `Rs. ${formatPKR(currentDue)}`;
  document.getElementById('customerPaymentModal').classList.add('active');
};

window.submitCustomerPayment = async function(e) {
  if (e) e.preventDefault();
  const customerId = document.getElementById('payCustomerId').value;
  const amount = parseFloat(document.getElementById('payCustomerAmount').value) || 0;
  const paymentMethod = document.getElementById('payCustomerMethod').value;
  const notes = document.getElementById('payCustomerNotes').value.trim();

  if (amount <= 0) {
    alert('Please enter a valid positive payment amount.');
    return;
  }

  try {
    const res = await fetchAPI(`/api/customers/${customerId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ amount, paymentMethod, notes })
    });

    if (res.success) {
      alert(`✓ ${res.message}`);
      closeModal('customerPaymentModal');
      loadCustomers();
      loadDashboardStats();
    } else {
      alert(`Error: ${res.message}`);
    }
  } catch (err) {
    alert(err.message);
  }
};

// ==========================================================================
// 8. SUPPLIER LEDGER & MILL PAYABLES
// ==========================================================================
async function loadSuppliers() {
  const tbody = document.getElementById('suppliersTableBody');
  if (!tbody) return;

  try {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;">Loading suppliers...</td></tr>`;
    const data = await fetchAPI('/api/suppliers');
    if (data.success && data.suppliers) {
      ADMIN_STATE.suppliers = data.suppliers;
      tbody.innerHTML = data.suppliers.map(s => `
        <tr>
          <td><strong>${escapeHTML(s.name)}</strong></td>
          <td>${s.company || '-'}</td>
          <td>${s.phone || '-'}</td>
          <td>Rs. ${formatPKR(s.totalPurchases)}</td>
          <td>Rs. ${formatPKR(s.totalPaid)}</td>
          <td style="font-weight:700;color:${s.outstandingPayable > 0 ? '#c92a2a' : '#2b8a3e'};">
            Rs. ${formatPKR(s.outstandingPayable)}
          </td>
          <td>
            <button class="btn-erp-gold" style="padding:4px 8px;font-size:0.75rem;" onclick="openSupplierPaymentModal('${s._id}', '${escapeHTML(s.name)}', ${s.outstandingPayable})">Pay Mill</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading suppliers:', err);
  }
}

window.openSupplierPaymentModal = function(supplierId, supplierName, currentPayable) {
  document.getElementById('paySupplierId').value = supplierId;
  document.getElementById('paySupplierName').textContent = supplierName;
  document.getElementById('paySupplierPayable').textContent = `Rs. ${formatPKR(currentPayable)}`;
  document.getElementById('supplierPaymentModal').classList.add('active');
};

window.submitSupplierPayment = async function(e) {
  if (e) e.preventDefault();
  const supplierId = document.getElementById('paySupplierId').value;
  const amount = parseFloat(document.getElementById('paySupplierAmount').value) || 0;
  const paymentMethod = document.getElementById('paySupplierMethod').value;
  const notes = document.getElementById('paySupplierNotes').value.trim();

  if (amount <= 0) {
    alert('Please enter a valid amount.');
    return;
  }

  try {
    const res = await fetchAPI(`/api/suppliers/${supplierId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ amount, paymentMethod, notes })
    });

    if (res.success) {
      alert(`✓ ${res.message}`);
      closeModal('supplierPaymentModal');
      loadSuppliers();
      loadDashboardStats();
    } else {
      alert(`Error: ${res.message}`);
    }
  } catch (err) {
    alert(err.message);
  }
};

// ==========================================================================
// 9. EXPENSE MANAGEMENT
// ==========================================================================
async function loadExpenses() {
  const tbody = document.getElementById('expensesTableBody');
  if (!tbody) return;

  try {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;">Loading shop expenses...</td></tr>`;
    const cat = document.getElementById('expenseCategoryFilter') ? document.getElementById('expenseCategoryFilter').value : '';
    let url = '/api/expenses?limit=100';
    if (cat && cat !== 'All') url += `&category=${encodeURIComponent(cat)}`;

    const data = await fetchAPI(url);
    if (data.success && data.expenses) {
      ADMIN_STATE.expenses = data.expenses;
      document.getElementById('totalExpensesSum').textContent = `Total: Rs. ${formatPKR(data.totalExpenseAmount)}`;

      tbody.innerHTML = data.expenses.map(e => `
        <tr>
          <td>${new Date(e.date).toLocaleDateString('en-PK')}</td>
          <td><strong>${e.category}</strong></td>
          <td>${escapeHTML(e.description || '-')}</td>
          <td style="font-weight:700;color:#c92a2a;">Rs. ${formatPKR(e.amount)}</td>
          <td>${e.paymentMethod}</td>
          <td>${escapeHTML(e.paidBy || '-')}</td>
          <td>
            <button class="btn-erp-outline" style="padding:4px 8px;font-size:0.75rem;color:#c92a2a;border-color:#c92a2a;" onclick="deleteExpenseAction('${e._id}')">🗑️ Delete</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading expenses:', err);
  }
}

window.deleteExpenseAction = function(expenseId) {
  showConfirmDialog({
    title: '💸 Delete Expense Record',
    message: 'Are you sure you want to delete this expense record from the shop ledger?',
    confirmText: 'Yes, Delete',
    confirmColor: '#c92a2a',
    onConfirm: async () => {
      const res = await fetchAPI(`/api/expenses/${expenseId}`, {
        method: 'DELETE'
      });
      if (res && res.success) {
        showToast('✓ Expense record deleted successfully.', 'success');
        loadExpenses();
        loadDashboardStats();
      } else {
        showToast(`Error: ${(res && res.message) || 'Failed to delete expense'}`, 'error');
      }
    }
  });
};

window.openNewExpenseModal = function() {
  document.getElementById('newExpenseModal').classList.add('active');
};

window.submitNewExpense = async function(e) {
  if (e) e.preventDefault();
  const category = document.getElementById('expCategory').value;
  const description = document.getElementById('expDescription').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value) || 0;
  const paymentMethod = document.getElementById('expPaymentMethod').value;
  const paidBy = document.getElementById('expPaidBy').value.trim();

  if (amount <= 0) {
    alert('Please enter a valid expense amount.');
    return;
  }

  try {
    const res = await fetchAPI('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({ category, description, amount, paymentMethod, paidBy })
    });

    if (res.success) {
      alert('✓ Expense recorded.');
      closeModal('newExpenseModal');
      loadExpenses();
      loadDashboardStats();
    } else {
      alert(`Error: ${res.message}`);
    }
  } catch (err) {
    alert(err.message);
  }
};

// ==========================================================================
// 10. PROFIT & LOSS (P&L) INCOME STATEMENT
// ==========================================================================
async function loadProfitLoss() {
  try {
    const period = document.getElementById('plPeriodSelect') ? document.getElementById('plPeriodSelect').value : 'this_month';
    const data = await fetchAPI(`/api/reports/download?type=pl&period=${period}`);
    if (data.success && data.financials) {
      const f = data.financials;
      document.getElementById('plGrossRevenue').textContent = `Rs. ${formatPKR(f.grossRevenue)}`;
      document.getElementById('plDiscounts').textContent = `Rs. ${formatPKR(f.totalDiscount)}`;
      document.getElementById('plNetRevenue').textContent = `Rs. ${formatPKR(f.netRevenue)}`;
      document.getElementById('plCOGS').textContent = `Rs. ${formatPKR(f.costOfGoodsSold)}`;
      document.getElementById('plGrossProfit').textContent = `Rs. ${formatPKR(f.grossProfit)}`;
      document.getElementById('plGrossMargin').textContent = `${f.grossMarginPercent}%`;
      document.getElementById('plOperatingExpenses').textContent = `Rs. ${formatPKR(f.operatingExpenses)}`;

      const netEl = document.getElementById('plNetProfit');
      netEl.textContent = `Rs. ${formatPKR(f.netProfit)}`;
      netEl.style.color = f.netProfit >= 0 ? '#2b8a3e' : '#c92a2a';
      document.getElementById('plNetMargin').textContent = `${f.netProfitMarginPercent}%`;

      // Render expense breakdown
      const expContainer = document.getElementById('plExpenseCategoryList');
      if (expContainer) {
        expContainer.innerHTML = Object.entries(f.expenseByCategory || {}).map(([cat, amt]) => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--erp-border-subtle);">
            <span>${cat}</span>
            <strong>Rs. ${formatPKR(amt)}</strong>
          </div>
        `).join('') || '<div style="color:var(--erp-muted);">No expenses recorded in this period.</div>';
      }
    }
  } catch (err) {
    console.error('Error loading P&L:', err);
  }
}

// ==========================================================================
// 11. CASH & BANK RECONCILIATION
// ==========================================================================
async function loadReconciliation() {
  try {
    const dateInput = document.getElementById('reconcileDate');
    const date = dateInput ? dateInput.value : '';
    const url = date ? `/api/reconciliation?date=${date}` : '/api/reconciliation';

    const data = await fetchAPI(url);
    if (data.success && data.summary) {
      const grid = document.getElementById('reconcileGrid');
      if (!grid) return;

      grid.innerHTML = Object.values(data.summary).map(acc => `
        <div class="kpi-card" style="border-top: 4px solid var(--erp-gold);">
          <div class="kpi-header">
            <span style="font-size:1.1rem;font-weight:700;">${acc.account} Account</span>
            <span class="badge-status ${acc.discrepancy === 0 ? 'paid' : (acc.discrepancy > 0 ? 'partial' : 'unpaid')}">${acc.status}</span>
          </div>

          <div style="font-size:0.8rem;line-height:1.8;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;"><span>Opening Balance:</span> <strong>Rs. ${formatPKR(acc.openingBalance)}</strong></div>
            <div style="display:flex;justify-content:space-between;color:#2b8a3e;"><span>Total Inflow (Sales + Due Received):</span> <strong>+Rs. ${formatPKR(acc.totalIn)}</strong></div>
            <div style="display:flex;justify-content:space-between;color:#c92a2a;"><span>Total Outflow (Expenses + Paid):</span> <strong>-Rs. ${formatPKR(acc.totalOut)}</strong></div>
            <div style="display:flex;justify-content:space-between;border-top:1px dashed var(--erp-border);padding-top:4px;">
              <span>Expected Closing:</span>
              <strong>Rs. ${formatPKR(acc.expectedClosing)}</strong>
            </div>
          </div>

          <div class="form-group-erp">
            <label>Manually Counted / Actual Balance (Rs.):</label>
            <input type="number" class="form-control-erp" id="actualBal_${acc.account}" value="${acc.actualClosing}">
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.75rem;color:${acc.discrepancy === 0 ? '#2b8a3e' : '#c92a2a'};font-weight:700;">
              Discrepancy: Rs. ${formatPKR(acc.discrepancy)}
            </span>
            <button class="btn-erp-action" style="padding:6px 12px;font-size:0.75rem;" onclick="saveAccountReconciliation('${acc.account}')">Save Balance</button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading reconciliation:', err);
  }
}

window.saveAccountReconciliation = async function(account) {
  const actualVal = parseFloat(document.getElementById(`actualBal_${account}`).value) || 0;
  const dateInput = document.getElementById('reconcileDate');
  const date = dateInput ? dateInput.value : '';

  try {
    const res = await fetchAPI('/api/reconciliation', {
      method: 'POST',
      body: JSON.stringify({ account, actualClosing: actualVal, date })
    });

    if (res.success) {
      alert(`✓ ${account} balance reconciled successfully.`);
      loadReconciliation();
    } else {
      alert(`Error: ${res.message}`);
    }
  } catch (err) {
    alert(err.message);
  }
};

// ==========================================================================
// 12. REPORT CENTER & CSV DOWNLOAD
// ==========================================================================
window.loadReportPreview = async function() {
  const type = document.getElementById('reportTypeSelect').value;
  const period = document.getElementById('reportPeriodSelect').value;

  try {
    const data = await fetchAPI(`/api/reports/download?type=${type}&period=${period}`);
    if (data.success) {
      const thead = document.getElementById('reportTableHead');
      const tbody = document.getElementById('reportTableBody');

      thead.innerHTML = `<tr>${data.headers.map(h => `<th>${escapeHTML(h)}</th>`).join('')}</tr>`;
      tbody.innerHTML = data.rows.map(row => `
        <tr>${row.map(cell => `<td>${escapeHTML(String(cell))}</td>`).join('')}</tr>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
};

window.downloadReportCSV = function() {
  const type = document.getElementById('reportTypeSelect').value;
  const period = document.getElementById('reportPeriodSelect').value;
  const token = localStorage.getItem('al_anwar_token');
  window.open(`/api/reports/download?type=${type}&period=${period}&format=csv&token=${token}`, '_blank');
};

// ==========================================================================
// 13. WEBSITE CMS & SETTINGS
// ==========================================================================
async function loadCMSAdmin() {
  try {
    const data = await fetchAPI('/api/cms/public');
    if (data.success) {
      // Announcements
      const annEl = document.getElementById('cmsAnnouncementsText');
      if (annEl) annEl.value = (data.announcements || []).join('\n');

      // Store settings
      if (data.storeSettings) {
        document.getElementById('cmsShopName').value = data.storeSettings.name || '';
        document.getElementById('cmsShopAddress').value = data.storeSettings.address || '';
        document.getElementById('cmsShopPhone').value = data.storeSettings.phone || '';
        document.getElementById('cmsShopWhatsapp').value = data.storeSettings.whatsapp || '';
      }
    }
    await loadCMSHeroSlides();
  } catch (err) {
    console.error(err);
  }
}

window.saveCMSAnnouncements = async function() {
  const textVal = document.getElementById('cmsAnnouncementsText').value;
  const items = textVal.split('\n').map(l => l.trim()).filter(Boolean);

  try {
    const res = await fetchAPI('/api/cms/announcements', {
      method: 'POST',
      body: JSON.stringify({ items })
    });
    if (res.success) {
      alert('✓ Announcement bar updated successfully.');
    }
  } catch (err) {
    alert(err.message);
  }
};

window.saveCMSSettings = async function() {
  const storeSettings = {
    name: document.getElementById('cmsShopName').value,
    address: document.getElementById('cmsShopAddress').value,
    phone: document.getElementById('cmsShopPhone').value,
    whatsapp: document.getElementById('cmsShopWhatsapp').value
  };

  try {
    const res = await fetchAPI('/api/cms/settings', {
      method: 'POST',
      body: JSON.stringify({ storeSettings })
    });
    if (res.success) {
      alert('✓ Store settings saved successfully.');
    }
  } catch (err) {
    alert(err.message);
  }
};

// Hero Banners Management
async function loadCMSHeroSlides() {
  const tbody = document.getElementById('cmsHeroSlidesTableBody');
  if (!tbody) return;

  try {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;">Loading hero banners...</td></tr>`;
    const data = await fetchAPI('/api/cms/hero-slides');
    if (data.success && data.slides) {
      ADMIN_STATE.heroSlides = data.slides;
      if (data.slides.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--erp-muted);">No hero slides yet. Add one above.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.slides.map(slide => `
        <tr>
          <td>
            <div style="width:90px; height:50px; border-radius:4px; overflow:hidden; background:linear-gradient(135deg,#c5a059,#faf7f0); display:flex; align-items:center; justify-content:center; border:1px solid var(--erp-border);">
              ${slide.image ? `<img src="${slide.image}" style="width:100%; height:100%; object-fit:cover;">` : '<span style="font-size:1.2rem;">✨</span>'}
            </div>
          </td>
          <td><strong>${escapeHTML(slide.heading)}</strong></td>
          <td style="font-size:0.75rem; color:var(--erp-secondary); max-width:240px;">${escapeHTML(slide.subheading || '-')}</td>
          <td><span class="badge-status in_stock" style="font-size:0.7rem;">${escapeHTML(slide.badge || 'EXCLUSIVE')}</span></td>
          <td><code>${escapeHTML(slide.buttonUrl || '#collection')}</code></td>
          <td><span class="badge-status ${slide.active ? 'in_stock' : 'out_of_stock'}">${slide.active ? 'Active' : 'Hidden'}</span></td>
          <td style="text-align:right;">
            <div style="display:inline-flex; gap:6px;">
              <button class="btn-erp-outline" style="padding:4px 8px;font-size:0.75rem;" onclick="openEditHeroSlideModal('${slide._id}')">✏️ Edit</button>
              <button class="btn-erp-outline" style="padding:4px 8px;font-size:0.75rem;color:#c92a2a;border-color:#c92a2a;" onclick="deleteHeroSlide('${slide._id}')">🗑️ Delete</button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading hero slides:', err);
  }
}

window.openNewHeroSlideModal = function() {
  document.getElementById('heroSlideEditId').value = '';
  document.getElementById('heroSlideModalTitle').textContent = '➕ Add Hero Carousel Banner';
  document.getElementById('heroHeading').value = '';
  document.getElementById('heroSubheading').value = '';
  document.getElementById('heroBadge').value = '✨ NEW FESTIVE 2026';
  document.getElementById('heroBtnText').value = 'SHOP COLLECTION';
  document.getElementById('heroBtnUrl').value = '#collection';
  document.getElementById('heroSortOrder').value = '0';
  document.getElementById('heroActive').checked = true;
  document.getElementById('heroImageFile').value = '';
  document.getElementById('heroImageUrl').value = '';
  document.getElementById('heroImagePreviewBox').innerHTML = '<span style="color:var(--erp-muted); font-size:0.8rem;">No custom banner image selected (Luxury gold gradient will be used)</span>';
  document.getElementById('heroSlideModal').classList.add('active');
};

window.openEditHeroSlideModal = function(id) {
  const slide = (ADMIN_STATE.heroSlides || []).find(s => s._id === id);
  if (!slide) return;

  document.getElementById('heroSlideEditId').value = slide._id;
  document.getElementById('heroSlideModalTitle').textContent = '✏️ Edit Hero Carousel Banner';
  document.getElementById('heroHeading').value = slide.heading || '';
  document.getElementById('heroSubheading').value = slide.subheading || '';
  document.getElementById('heroBadge').value = slide.badge || '';
  document.getElementById('heroBtnText').value = slide.buttonText || '';
  document.getElementById('heroBtnUrl').value = slide.buttonUrl || '';
  document.getElementById('heroSortOrder').value = slide.sortOrder || 0;
  document.getElementById('heroActive').checked = slide.active !== false;
  document.getElementById('heroImageFile').value = '';
  document.getElementById('heroImageUrl').value = slide.image || '';

  const box = document.getElementById('heroImagePreviewBox');
  if (slide.image) {
    box.innerHTML = `<img src="${slide.image}" style="width:100%; height:100%; object-fit:cover;">`;
  } else {
    box.innerHTML = '<span style="color:var(--erp-muted); font-size:0.8rem;">No custom banner image selected (Luxury gold gradient will be used)</span>';
  }

  document.getElementById('heroSlideModal').classList.add('active');
};

window.handleHeroImageFileSelect = function(input) {
  const previewBox = document.getElementById('heroImagePreviewBox');
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      if (previewBox) {
        previewBox.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
      }
    };
    reader.readAsDataURL(input.files[0]);
  }
};

window.handleHeroImageUrlInput = function(url) {
  const previewBox = document.getElementById('heroImagePreviewBox');
  if (!previewBox) return;
  if (url && url.trim()) {
    previewBox.innerHTML = `<img src="${url.trim()}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'color:#c92a2a;font-size:0.8rem;\\'>⚠️ Invalid or unreachable image link</span>';">`;
  } else {
    previewBox.innerHTML = '<span style="color:var(--erp-muted); font-size:0.8rem;">No custom banner image selected (Luxury gold gradient will be used)</span>';
  }
};

window.submitHeroSlideForm = async function(e) {
  if (e) e.preventDefault();
  const id = document.getElementById('heroSlideEditId').value;
  const isEdit = Boolean(id);

  const fileInput = document.getElementById('heroImageFile');
  const hasFile = fileInput.files && fileInput.files[0];

  const btn = document.getElementById('btnSaveHeroSlide');
  btn.disabled = true;
  btn.textContent = isEdit ? 'Updating Banner...' : 'Saving Banner...';

  try {
    let res;
    if (hasFile) {
      const formData = new FormData();
      formData.append('heading', document.getElementById('heroHeading').value.trim());
      formData.append('subheading', document.getElementById('heroSubheading').value.trim());
      formData.append('badge', document.getElementById('heroBadge').value.trim());
      formData.append('buttonText', document.getElementById('heroBtnText').value.trim());
      formData.append('buttonUrl', document.getElementById('heroBtnUrl').value.trim());
      formData.append('sortOrder', document.getElementById('heroSortOrder').value);
      formData.append('active', document.getElementById('heroActive').checked);
      formData.append('image', fileInput.files[0]);

      const token = ADMIN_STATE.token;
      const endpoint = isEdit ? `/api/cms/hero-slides/${id}` : '/api/cms/hero-slides';
      const fetchRes = await fetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      try {
        res = await fetchRes.json();
      } catch (jsonErr) {
        throw new Error(`Server returned HTTP ${fetchRes.status}`);
      }
    } else {
      const payload = {
        heading: document.getElementById('heroHeading').value.trim(),
        subheading: document.getElementById('heroSubheading').value.trim(),
        badge: document.getElementById('heroBadge').value.trim(),
        buttonText: document.getElementById('heroBtnText').value.trim(),
        buttonUrl: document.getElementById('heroBtnUrl').value.trim(),
        sortOrder: document.getElementById('heroSortOrder').value,
        active: document.getElementById('heroActive').checked,
        image: document.getElementById('heroImageUrl').value.trim()
      };

      res = await fetchAPI(isEdit ? `/api/cms/hero-slides/${id}` : '/api/cms/hero-slides', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
    }

    if (res && res.success) {
      showToast(`✓ Hero banner ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
      closeModal('heroSlideModal');
      await loadCMSHeroSlides();
    } else {
      const msg = (res && res.message) || 'Failed to save hero banner.';
      showToast(`Error: ${msg}`, 'error');
    }
  } catch (err) {
    showToast(`Upload Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Hero Banner';
  }
};

window.deleteHeroSlide = function(id) {
  showConfirmDialog({
    title: '🖼️ Delete Hero Banner',
    message: 'Are you sure you want to delete this hero banner from the homepage carousel?',
    confirmText: 'Yes, Delete Banner',
    confirmColor: '#c92a2a',
    onConfirm: async () => {
      const res = await fetchAPI(`/api/cms/hero-slides/${id}`, {
        method: 'DELETE'
      });
      if (res && res.success) {
        showToast('✓ Hero banner deleted successfully.', 'success');
        loadCMSHeroSlides();
      } else {
        showToast(`Error: ${(res && res.message) || 'Failed to delete hero banner'}`, 'error');
      }
    }
  });
};

// ==========================================================================
// 14. PRODUCTS & FABRICS MANAGEMENT (CRUD + IMAGE UPLOAD)
// ==========================================================================
window.loadAdminProducts = async function() {
  const tbody = document.getElementById('adminProductsTableBody');
  if (!tbody) return;

  try {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;">Loading product catalog...</td></tr>`;
    const data = await fetchAPI('/api/products/admin/all');
    if (data.success && data.products) {
      ADMIN_STATE.products = data.products;
      populateCategoryFilterOptions();
      filterAdminProducts();
    }
  } catch (err) {
    console.error('Error loading admin products:', err);
  }
};

function populateCategoryFilterOptions() {
  const select = document.getElementById('adminProductCategoryFilter');
  if (!select) return;

  const categories = Array.from(new Set(ADMIN_STATE.products.map(p => p.category).filter(Boolean)));
  select.innerHTML = '<option value="All">All Categories</option>' + 
    categories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
}

window.filterAdminProducts = function() {
  const tbody = document.getElementById('adminProductsTableBody');
  if (!tbody) return;

  const search = (document.getElementById('adminProductSearch')?.value || '').toLowerCase().trim();
  const category = document.getElementById('adminProductCategoryFilter')?.value || 'All';

  let filtered = ADMIN_STATE.products.filter(p => {
    const matchSearch = !search || 
      (p.name && p.name.toLowerCase().includes(search)) || 
      (p.sku && p.sku.toLowerCase().includes(search)) ||
      (p.fabricType && p.fabricType.toLowerCase().includes(search));
    const matchCat = category === 'All' || p.category === category;
    return matchSearch && matchCat;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--erp-muted);">No fabrics found matching filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const hasImage = Boolean(p.imageUrl || (p.images && p.images[0]));
    const imgHtml = hasImage 
      ? `<img src="${p.imageUrl || p.images[0]}" alt="" style="width:40px; height:50px; object-fit:cover; border-radius:3px; border:1px solid var(--erp-border);">`
      : `<span style="font-size:1.6rem;">${p.emojiIcon || '👗'}</span>`;

    return `
      <tr>
        <td style="text-align:center;">${imgHtml}</td>
        <td>
          <strong>${escapeHTML(p.name)}</strong>
          <div style="font-size:0.75rem; color:var(--erp-secondary);">🧵 ${escapeHTML(p.fabricType || 'Lawn')} ${p.color ? `• ${escapeHTML(p.color)}` : ''}</div>
        </td>
        <td><code>${escapeHTML(p.sku)}</code></td>
        <td><span class="badge-status in_stock" style="font-size:0.72rem;">${escapeHTML(p.category)}</span></td>
        <td>
          <strong style="font-size:1.05rem; color:${p.stock <= 5 ? '#c92a2a' : 'inherit'};">${p.stock || 0}</strong>
          ${p.stock <= (p.lowStockThreshold || 5) ? '<span style="color:#c92a2a; font-size:0.68rem; display:block; font-weight:700;">LOW</span>' : ''}
        </td>
        <td>Rs. ${formatPKR(p.costPrice)}</td>
        <td style="font-weight:700;">Rs. ${formatPKR(p.retailPrice)}</td>
        <td>Rs. ${formatPKR(p.wholesalePrice || p.retailPrice)}</td>
        <td>
          <span class="badge-status ${p.isArchived ? 'out_of_stock' : (p.stock <= 0 ? 'out_of_stock' : 'in_stock')}">
            ${p.isArchived ? 'Archived' : (p.stock <= 0 ? 'Sold Out' : 'Active')}
          </span>
        </td>
        <td style="text-align:right;">
          <div style="display:inline-flex; gap:6px;">
            <button class="btn-erp-outline" style="padding:4px 8px;font-size:0.75rem;" onclick="openEditProductModal('${p._id}')">✏️ Edit</button>
            <button class="btn-erp-outline" style="padding:4px 8px;font-size:0.75rem;color:#c92a2a;border-color:#c92a2a;" onclick="deleteProduct('${p._id}')">🗑️ Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

window.openNewProductModal = function() {
  document.getElementById('prodEditId').value = '';
  document.getElementById('productModalTitle').textContent = '➕ Add New Product / Suit';
  document.getElementById('prodName').value = '';
  document.getElementById('prodSku').value = 'ANW-' + Math.floor(1000 + Math.random() * 9000);
  document.getElementById('prodCategory').value = 'Unstitched Lawn';
  document.getElementById('prodFabricType').value = 'Swiss Lawn';
  document.getElementById('prodColor').value = '';
  document.getElementById('prodCostPrice').value = '2800';
  document.getElementById('prodRetailPrice').value = '4850';
  document.getElementById('prodWholesalePrice').value = '3850';
  document.getElementById('prodSalePrice').value = '';
  document.getElementById('prodStock').value = '25';
  document.getElementById('prodThreshold').value = '5';
  document.getElementById('prodEmoji').value = '👗';
  document.getElementById('prodImageFile').value = '';
  document.getElementById('prodImageUrl').value = '';
  document.getElementById('prodBadges').value = 'NEW ARRIVAL';
  document.getElementById('prodIsOnSale').checked = false;
  document.getElementById('prodActive').checked = true;
  document.getElementById('prodDescription').value = '';
  document.getElementById('prodImagePreviewBox').innerHTML = '<span style="font-size:2rem;" id="prodImagePreviewEmoji">👗</span>';

  document.getElementById('productModal').classList.add('active');
};

window.openEditProductModal = function(id) {
  const p = (ADMIN_STATE.products || []).find(item => String(item._id) === String(id));
  if (!p) {
    console.error('Product not found for edit:', id);
    showToast('Product data is loading, please wait...', 'warning');
    return;
  }

  const errBox = document.getElementById('prodModalError');
  if (errBox) {
    errBox.style.display = 'none';
    errBox.textContent = '';
  }

  document.getElementById('prodEditId').value = p._id;
  document.getElementById('productModalTitle').textContent = '✏️ Edit Product / Fabric';
  document.getElementById('prodName').value = p.name || '';
  document.getElementById('prodSku').value = p.sku || '';
  document.getElementById('prodCategory').value = p.category || 'Unstitched Lawn';
  document.getElementById('prodFabricType').value = p.fabricType || '';
  document.getElementById('prodColor').value = p.color || '';
  document.getElementById('prodCostPrice').value = p.costPrice !== undefined ? p.costPrice : 0;
  document.getElementById('prodRetailPrice').value = p.retailPrice !== undefined ? p.retailPrice : 0;
  document.getElementById('prodWholesalePrice').value = p.wholesalePrice !== undefined ? p.wholesalePrice : p.retailPrice;
  document.getElementById('prodSalePrice').value = p.salePrice || '';
  document.getElementById('prodStock').value = p.stock !== undefined ? p.stock : 0;
  document.getElementById('prodThreshold').value = p.lowStockThreshold || 5;
  document.getElementById('prodEmoji').value = p.emojiIcon || '👗';
  document.getElementById('prodImageFile').value = '';
  document.getElementById('prodImageUrl').value = p.imageUrl || (p.images && p.images[0]) || '';
  document.getElementById('prodBadges').value = Array.isArray(p.badges) ? p.badges.join(', ') : (p.badges || '');
  document.getElementById('prodIsOnSale').checked = Boolean(p.isOnSale);
  document.getElementById('prodActive').checked = p.active !== false;
  document.getElementById('prodDescription').value = p.description || '';

  const previewBox = document.getElementById('prodImagePreviewBox');
  const hasImg = Boolean(p.imageUrl || (p.images && p.images[0]));
  if (hasImg) {
    previewBox.innerHTML = `<img src="${p.imageUrl || p.images[0]}" style="width:100%; height:100%; object-fit:cover;">`;
  } else {
    previewBox.innerHTML = `<span style="font-size:2rem;">${p.emojiIcon || '👗'}</span>`;
  }

  const btn = document.getElementById('btnSaveProduct');
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Update Product';
  }

  document.getElementById('productModal').classList.add('active');
};

window.handleProductImageFileSelect = function(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('prodImagePreviewBox').innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
    };
    reader.readAsDataURL(input.files[0]);
  }
};

window.handleProductImageUrlInput = function(url) {
  if (url && url.trim()) {
    document.getElementById('prodImagePreviewBox').innerHTML = `<img src="${url.trim()}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src=''; this.alt='Invalid URL';">`;
  }
};

window.submitProductForm = async function(e) {
  if (e) e.preventDefault();
  const id = document.getElementById('prodEditId').value;
  const isEdit = Boolean(id);

  const fileInput = document.getElementById('prodImageFile');
  const hasFile = fileInput.files && fileInput.files[0];

  const btn = document.getElementById('btnSaveProduct');
  const errorBox = document.getElementById('prodModalError');
  if (errorBox) {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  }

  btn.disabled = true;
  btn.textContent = isEdit ? 'Updating...' : 'Saving...';

  try {
    let res;
    if (hasFile) {
      const formData = new FormData();
      formData.append('name', document.getElementById('prodName').value.trim());
      formData.append('sku', document.getElementById('prodSku').value.trim().toUpperCase());
      formData.append('category', document.getElementById('prodCategory').value);
      formData.append('fabricType', document.getElementById('prodFabricType').value.trim());
      formData.append('color', document.getElementById('prodColor').value.trim());
      formData.append('costPrice', document.getElementById('prodCostPrice').value);
      formData.append('retailPrice', document.getElementById('prodRetailPrice').value);
      formData.append('wholesalePrice', document.getElementById('prodWholesalePrice').value);
      if (document.getElementById('prodSalePrice').value) {
        formData.append('salePrice', document.getElementById('prodSalePrice').value);
      }
      formData.append('stock', document.getElementById('prodStock').value);
      formData.append('lowStockThreshold', document.getElementById('prodThreshold').value);
      formData.append('emojiIcon', document.getElementById('prodEmoji').value.trim() || '👗');
      formData.append('badges', document.getElementById('prodBadges').value.split(',').map(b => b.trim()).filter(Boolean));
      formData.append('isOnSale', document.getElementById('prodIsOnSale').checked);
      formData.append('active', document.getElementById('prodActive').checked);
      formData.append('description', document.getElementById('prodDescription').value.trim());
      formData.append('image', fileInput.files[0]);

      const token = ADMIN_STATE.token;
      const endpoint = isEdit ? `/api/products/${id}` : '/api/products';
      const fetchRes = await fetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      try {
        res = await fetchRes.json();
      } catch (jsonErr) {
        throw new Error(`Server returned HTTP ${fetchRes.status}`);
      }
    } else {
      const payload = {
        name: document.getElementById('prodName').value.trim(),
        sku: document.getElementById('prodSku').value.trim().toUpperCase(),
        category: document.getElementById('prodCategory').value,
        fabricType: document.getElementById('prodFabricType').value.trim(),
        color: document.getElementById('prodColor').value.trim(),
        costPrice: parseFloat(document.getElementById('prodCostPrice').value) || 0,
        retailPrice: parseFloat(document.getElementById('prodRetailPrice').value) || 0,
        wholesalePrice: parseFloat(document.getElementById('prodWholesalePrice').value) || 0,
        salePrice: document.getElementById('prodSalePrice').value ? parseFloat(document.getElementById('prodSalePrice').value) : null,
        stock: parseInt(document.getElementById('prodStock').value, 10) || 0,
        lowStockThreshold: parseInt(document.getElementById('prodThreshold').value, 10) || 5,
        emojiIcon: document.getElementById('prodEmoji').value.trim() || '👗',
        badges: document.getElementById('prodBadges').value.split(',').map(b => b.trim()).filter(Boolean),
        isOnSale: document.getElementById('prodIsOnSale').checked,
        active: document.getElementById('prodActive').checked,
        description: document.getElementById('prodDescription').value.trim(),
        imageUrl: document.getElementById('prodImageUrl').value.trim()
      };

      res = await fetchAPI(isEdit ? `/api/products/${id}` : '/api/products', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
    }

    if (res && res.success) {
      showToast(`✓ Product ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
      closeModal('productModal');
      await loadProductsCatalog();
      loadAdminProducts();
      loadInventory();
      loadDashboardStats();
    } else {
      const errMsg = (res && res.message) || 'Error processing request';
      if (errorBox) {
        errorBox.style.display = 'block';
        errorBox.textContent = `❌ ${errMsg}`;
      }
      showToast(`Error: ${errMsg}`, 'error');
    }
  } catch (err) {
    if (errorBox) {
      errorBox.style.display = 'block';
      errorBox.textContent = `❌ ${err.message}`;
    }
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = isEdit ? 'Update Product' : 'Save Product';
  }
};

window.deleteProduct = function(id) {
  const p = (ADMIN_STATE.products || []).find(item => String(item._id) === String(id));
  const name = p ? p.name : 'Selected Product';
  const sku = p ? p.sku : '';

  showConfirmDialog({
    title: '🗑️ Delete / Archive Product',
    message: `Are you sure you want to remove <strong>"${escapeHTML(name)}"</strong>?`,
    details: sku ? `SKU: ${sku} • Database ID: ${id}` : `ID: ${id}`,
    confirmText: 'Yes, Delete',
    confirmColor: '#c92a2a',
    onConfirm: async () => {
      const res = await fetchAPI(`/api/products/${id}`, {
        method: 'DELETE'
      });
      if (res && res.success) {
        showToast(`✓ ${res.message || 'Product deleted/archived successfully.'}`, 'success');
        await loadProductsCatalog();
        loadAdminProducts();
        loadInventory();
        loadDashboardStats();
      } else {
        showToast(`Error: ${(res && res.message) || 'Failed to delete product'}`, 'error');
      }
    }
  });
};

// ==========================================================================
// 14. HELPERS
// ==========================================================================
function formatPKR(val) {
  return Number(val || 0).toLocaleString('en-PK');
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
