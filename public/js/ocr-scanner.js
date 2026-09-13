/**
 * AL ANWAR FABRICS & CLOTH - Bill Scanner & OCR Module
 * "Bill ki Photo Se Hisab"
 * Workflow: PHOTO -> OCR -> EXTRACTED DATA -> EDITABLE PREVIEW -> USER CONFIRMS -> SAVE TO DATABASE
 */

const OCR_STATE = {
  currentImageFile: null,
  extractedItems: [],
  detectedCustomer: '',
  detectedTotal: 0
};

// Initialize Drag & Drop and File Inputs
function initOCRScanner() {
  const dropzone = document.getElementById('ocrDropzone');
  const fileInput = document.getElementById('ocrFileInput');
  const cameraInput = document.getElementById('ocrCameraInput');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleOCRImageSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleOCRImageSelected(e.target.files[0]);
    }
  });

  if (cameraInput) {
    cameraInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleOCRImageSelected(e.target.files[0]);
      }
    });
  }
}

// When an image is picked, preview it and trigger OCR
async function handleOCRImageSelected(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please select a valid image file (JPEG, PNG).');
    return;
  }

  OCR_STATE.currentImageFile = file;

  // Show preview
  const previewImg = document.getElementById('ocrPreviewImg');
  const previewWrap = document.getElementById('ocrPreviewWrap');
  const dropzonePrompt = document.getElementById('dropzonePrompt');
  const statusBox = document.getElementById('ocrStatusBox');
  const progressFill = document.getElementById('ocrProgressFill');
  const statusText = document.getElementById('ocrStatusText');

  const reader = new FileReader();
  reader.onload = (e) => {
    if (previewImg) previewImg.src = e.target.result;
    if (previewWrap) previewWrap.style.display = 'block';
    if (dropzonePrompt) dropzonePrompt.style.display = 'none';
  };
  reader.readAsDataURL(file);

  // Start OCR workflow
  if (statusBox) statusBox.style.display = 'block';
  if (statusText) statusText.textContent = 'Initializing optical character recognition engine...';
  if (progressFill) progressFill.style.width = '15%';

  try {
    let extractedText = '';

    // Check if Tesseract.js is loaded
    if (window.Tesseract) {
      statusText.textContent = 'Scanning bill image text with Tesseract.js...';
      const result = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 100);
            if (progressFill) progressFill.style.width = `${pct}%`;
            if (statusText) statusText.textContent = `Reading bill details... (${pct}%)`;
          }
        }
      });
      extractedText = result.data.text;
    } else {
      // Fallback: send to server parser
      statusText.textContent = 'Uploading to server for receipt line analysis...';
      if (progressFill) progressFill.style.width = '50%';
    }

    // Call server pattern parsing heuristics
    const formData = new FormData();
    formData.append('billImage', file);
    formData.append('rawText', extractedText);

    const token = localStorage.getItem('al_anwar_token');
    const res = await fetch('/api/ocr/parse-bill', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await res.json();
    if (data.success && data.extracted) {
      if (progressFill) progressFill.style.width = '100%';
      if (statusText) statusText.innerHTML = `✓ OCR Complete! Extracted ${data.extracted.items.length} line items. <strong>Review & edit below before saving.</strong>`;
      populateEditablePreview(data.extracted);
    } else {
      throw new Error(data.message || 'Failed to parse bill.');
    }
  } catch (ocrErr) {
    console.error('OCR Error:', ocrErr);
    if (statusText) statusText.innerHTML = `⚠️ OCR Note: Could not auto-detect items clearly. You can manually enter items below.`;
    // Populate an empty row for manual entry
    populateEditablePreview({
      items: [{ name: 'Lawn Unstitched Suit', quantity: 1, unitPrice: 3500, lineTotal: 3500 }],
      detectedCustomer: '',
      detectedTotal: 3500
    });
  }
}

// Populate the Editable Confirmation Table
function populateEditablePreview(extracted) {
  const container = document.getElementById('ocrEditableSection');
  const tbody = document.getElementById('ocrEditableTableBody');
  const custNameInput = document.getElementById('ocrCustomerName');
  const custPhoneInput = document.getElementById('ocrCustomerPhone');
  const totalDisplay = document.getElementById('ocrTotalDisplay');

  if (!container || !tbody) return;
  container.style.display = 'block';

  if (custNameInput && extracted.detectedCustomer) {
    custNameInput.value = extracted.detectedCustomer;
  }

  OCR_STATE.extractedItems = extracted.items && extracted.items.length > 0
    ? extracted.items
    : [{ name: 'Unstitched Suit', quantity: 1, unitPrice: 3000, lineTotal: 3000 }];

  renderEditableRows();
}

function renderEditableRows() {
  const tbody = document.getElementById('ocrEditableTableBody');
  if (!tbody) return;

  tbody.innerHTML = OCR_STATE.extractedItems.map((item, idx) => `
    <tr>
      <td>
        <input type="text" class="tbl-input" value="${escapeHTML(item.name)}" oninput="updateOcrRow(${idx}, 'name', this.value)" placeholder="Fabric / Suit Name">
      </td>
      <td style="width: 90px;">
        <input type="number" class="tbl-input" value="${item.quantity || 1}" min="1" oninput="updateOcrRow(${idx}, 'quantity', this.value)">
      </td>
      <td style="width: 120px;">
        <input type="number" class="tbl-input" value="${item.unitPrice || 0}" min="0" oninput="updateOcrRow(${idx}, 'unitPrice', this.value)">
      </td>
      <td style="width: 120px; font-weight: 700; text-align: right; padding-right: 12px;">
        Rs. ${Number(item.quantity * item.unitPrice).toLocaleString('en-PK')}
      </td>
      <td style="width: 40px; text-align: center;">
        <button type="button" onclick="deleteOcrRow(${idx})" style="color: #c92a2a; font-size: 1.1rem; cursor: pointer;">✕</button>
      </td>
    </tr>
  `).join('');

  recalcOcrTotals();
}

window.updateOcrRow = function(index, field, value) {
  if (!OCR_STATE.extractedItems[index]) return;
  if (field === 'quantity') {
    OCR_STATE.extractedItems[index].quantity = parseInt(value, 10) || 1;
  } else if (field === 'unitPrice') {
    OCR_STATE.extractedItems[index].unitPrice = parseFloat(value) || 0;
  } else {
    OCR_STATE.extractedItems[index][field] = value;
  }
  OCR_STATE.extractedItems[index].lineTotal = OCR_STATE.extractedItems[index].quantity * OCR_STATE.extractedItems[index].unitPrice;
  renderEditableRows();
};

window.deleteOcrRow = function(index) {
  OCR_STATE.extractedItems.splice(index, 1);
  renderEditableRows();
};

window.addOcrBlankRow = function() {
  OCR_STATE.extractedItems.push({
    name: 'New Fabric Item',
    quantity: 1,
    unitPrice: 2500,
    lineTotal: 2500
  });
  renderEditableRows();
};

function recalcOcrTotals() {
  const total = OCR_STATE.extractedItems.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
  OCR_STATE.detectedTotal = total;
  const totalDisplay = document.getElementById('ocrTotalDisplay');
  if (totalDisplay) {
    totalDisplay.textContent = `Rs. ${total.toLocaleString('en-PK')}`;
  }
}

// User Confirms & Saves Extracted Bill to Live Sales Database
window.confirmAndSaveOcrBill = async function() {
  if (OCR_STATE.extractedItems.length === 0) {
    alert('Please add at least one line item to the bill.');
    return;
  }

  const custName = document.getElementById('ocrCustomerName').value.trim() || 'Walk-in Customer';
  const custPhone = document.getElementById('ocrCustomerPhone').value.trim();
  const paymentMethod = document.getElementById('ocrPaymentMethod').value;
  const saleType = document.getElementById('ocrSaleType').value;
  const notes = document.getElementById('ocrNotes').value.trim();

  // Find or map matching products in catalog, or use first available product ID
  const allProducts = window.ADMIN_STATE ? window.ADMIN_STATE.products : [];
  const defaultProduct = allProducts[0];

  const payloadItems = OCR_STATE.extractedItems.map(item => {
    // Try to match product by name in catalog
    const matched = allProducts.find(p => p.name.toLowerCase().includes(item.name.toLowerCase()));
    return {
      productId: matched ? matched._id : (defaultProduct ? defaultProduct._id : null),
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    };
  });

  if (!defaultProduct && payloadItems.some(i => !i.productId)) {
    alert('Catalog is empty. Please create at least one product in Inventory first.');
    return;
  }

  const total = OCR_STATE.extractedItems.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);

  const payload = {
    customerName: custName,
    customerPhone: custPhone,
    saleType,
    paymentMethod,
    amountPaid: paymentMethod === 'Credit' ? 0 : total,
    discount: 0,
    items: payloadItems,
    notes: `Extracted via Bill Photo OCR. ${notes}`
  };

  try {
    const token = localStorage.getItem('al_anwar_token');
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      alert(`✓ Bill successfully committed to Sales Ledger!\nInvoice #${data.invoiceNumber}\nTotal: Rs. ${total.toLocaleString('en-PK')}`);
      // Reset OCR state
      document.getElementById('ocrEditableSection').style.display = 'none';
      document.getElementById('ocrPreviewWrap').style.display = 'none';
      document.getElementById('dropzonePrompt').style.display = 'block';
      document.getElementById('ocrStatusBox').style.display = 'none';
      OCR_STATE.extractedItems = [];
      OCR_STATE.currentImageFile = null;

      // Refresh sales and dashboard
      if (window.loadSales) window.loadSales();
      if (window.loadDashboardStats) window.loadDashboardStats();
      if (window.switchTab) window.switchTab('sales');
    } else {
      alert(`Error saving bill: ${data.message}`);
    }
  } catch (err) {
    console.error('Error saving OCR bill:', err);
    alert('Server error while saving bill. Please check your connection.');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initOCRScanner();
});
