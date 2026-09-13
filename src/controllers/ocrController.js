// Server-side OCR helper & receipt parser
// Provides pattern extraction heuristics for Pakistani cloth market bills

function parseReceiptText(text) {
  if (!text || typeof text !== 'string') {
    return {
      items: [],
      detectedTotal: 0,
      confidence: 'low'
    };
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  let detectedTotal = 0;
  let detectedCustomer = '';
  let detectedDate = '';

  // Common Pakistani cloth market bill line patterns:
  // e.g., "Lawn 3pc 5 3200 16000" or "Chiffon Suit x 2 @ 4500 = 9000" or "Cotton thaan 10m 250 = 2500"
  for (const line of lines) {
    // Check for customer name indicator
    if (/(?:name|m\/s|customer|shri|janab)[\s:]+([a-zA-Z\s]{3,30})/i.test(line)) {
      const match = line.match(/(?:name|m\/s|customer|shri|janab)[\s:]+([a-zA-Z\s]{3,30})/i);
      if (match && match[1]) detectedCustomer = match[1].trim();
    }

    // Check for date indicator (e.g. 12/03/2026 or 2026-03-12)
    const dateMatch = line.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/);
    if (dateMatch) {
      detectedDate = dateMatch[1];
    }

    // Check for total line
    if (/(?:total|net total|g\.total|mizan|kul)[\s:=Rs.]*([0-9,.]+)/i.test(line)) {
      const totalMatch = line.match(/(?:total|net total|g\.total|mizan|kul)[\s:=Rs.]*([0-9,.]+)/i);
      if (totalMatch && totalMatch[1]) {
        const clean = totalMatch[1].replace(/,/g, '');
        detectedTotal = parseFloat(clean) || 0;
      }
      continue;
    }

    // Parse product line: Name followed by qty, rate, and optional line total
    // Pattern 1: Name, qty x rate = total
    const p1 = line.match(/(.+?)\s+(\d+)\s*(?:x|@|rate|\*)\s*([0-9,.]+)\s*(?:=)?\s*([0-9,.]*)/i);
    if (p1) {
      const name = p1[1].replace(/^[\d.)\s-]+/, '').trim();
      const qty = parseInt(p1[2], 10) || 1;
      const rate = parseFloat(p1[3].replace(/,/g, '')) || 0;
      const total = p1[4] ? parseFloat(p1[4].replace(/,/g, '')) : (qty * rate);

      if (name.length > 2 && rate > 0) {
        items.push({
          name,
          quantity: qty,
          unitPrice: rate,
          lineTotal: total || (qty * rate)
        });
        continue;
      }
    }

    // Pattern 2: Name with numbers separated by spaces (e.g., "Lawn suit 4 2500 10000")
    const p2 = line.match(/^([a-zA-Z\s\u0600-\u06FF-]{3,35})\s+(\d+)\s+([0-9,.]+)(?:\s+([0-9,.]+))?$/);
    if (p2) {
      const name = p2[1].trim();
      const qty = parseInt(p2[2], 10) || 1;
      const rate = parseFloat(p2[3].replace(/,/g, '')) || 0;
      const total = p2[4] ? parseFloat(p2[4].replace(/,/g, '')) : (qty * rate);

      if (name.length > 2 && rate > 0) {
        items.push({
          name,
          quantity: qty,
          unitPrice: rate,
          lineTotal: total || (qty * rate)
        });
      }
    }
  }

  // If no items were parsed by strict patterns, split words heuristic
  if (items.length === 0 && lines.length > 0) {
    for (const line of lines) {
      const numbers = line.match(/\b\d+(?:\.\d+)?\b/g);
      if (numbers && numbers.length >= 2) {
        const textPart = line.replace(/[0-9.,:=x@*]/g, ' ').trim();
        const qty = parseInt(numbers[0], 10) || 1;
        const rate = parseFloat(numbers[1]) || 0;
        if (textPart.length > 2 && rate > 100) {
          items.push({
            name: textPart,
            quantity: qty,
            unitPrice: rate,
            lineTotal: qty * rate
          });
        }
      }
    }
  }

  const computedTotal = items.reduce((sum, i) => sum + i.lineTotal, 0);

  return {
    rawLinesCount: lines.length,
    detectedCustomer,
    detectedDate,
    detectedTotal: detectedTotal || computedTotal,
    items,
    confidence: items.length > 0 ? 'high' : 'low'
  };
}

async function parseBillImage(req, res, next) {
  try {
    const rawText = req.body.rawText;
    const billImageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.billImageUrl;

    const parsed = parseReceiptText(rawText);

    res.json({
      success: true,
      message: 'Bill parsed successfully for preview.',
      billImageUrl,
      extracted: parsed
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  parseReceiptText,
  parseBillImage
};
