import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { existsSync } from 'fs';
import db from '../database.js';
import { logActivity } from './activityLog.js';

const router = Router();

function getNextOrderNumber() {
  let num;
  const last = db.prepare("SELECT order_number FROM purchase_orders ORDER BY id DESC LIMIT 1").get();
  if (!last) {
    num = Math.floor(Math.random() * 9000) + 1000;
  } else {
    const lastNum = parseInt(last.order_number.replace('OC-', ''));
    num = lastNum + Math.floor(Math.random() * 5) + 1;
  }
  return `OC-${String(num).padStart(5, '0')}`;
}

router.get('/', (req, res) => {
  const orders = db.prepare(`SELECT po.*, s.name as supplier_display_name
    FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id
    ORDER BY po.id DESC`).all();
  res.json(orders);
});

router.get('/company', (req, res) => {
  const settings = db.prepare('SELECT * FROM company_settings WHERE id = 1').get();
  res.json(settings || {});
});

router.put('/company', (req, res) => {
  const { name, trade_name, cnpj, ie, phone, email, address, city, state, zip, logo_base64, nfe_email } = req.body;
  db.prepare(`UPDATE company_settings SET name=?, trade_name=?, cnpj=?, ie=?, phone=?, email=?, address=?, city=?, state=?, zip=?, logo_base64=?, nfe_email=? WHERE id=1`)
    .run(name || '', trade_name || '', cnpj || '', ie || '', phone || '', email || '', address || '', city || '', state || '', zip || '', logo_base64 || '', nfe_email || '');
  res.json({ success: true });
});

router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Ordem não encontrada' });
  const items = db.prepare('SELECT * FROM purchase_order_items WHERE order_id = ?').all(order.id);
  res.json({ ...order, items });
});

router.post('/', (req, res) => {
  const { supplier_id, supplier_name, supplier_cnpj, supplier_phone, supplier_email, supplier_address, supplier_contact,
    payment_type, payment_condition, freight_type, carrier, freight_value, delivery_deadline, notes, items, buyer_name, delivery_address, discount_percent } = req.body;

  if (!supplier_name || !items || items.length === 0) return res.status(400).json({ error: 'Fornecedor e itens são obrigatórios' });

  const order_number = getNextOrderNumber();
  const discountPct = parseFloat(discount_percent) || 0;

  let subtotal = 0;
  let ipi_total = 0;
  for (const item of items) {
    const itemTotal = (item.quantity || 1) * (item.unit_price || 0);
    const ipiVal = itemTotal * ((item.ipi_percent || 0) / 100);
    subtotal += itemTotal;
    ipi_total += ipiVal;
  }
  const discountValue = (subtotal + ipi_total) * (discountPct / 100);
  const total = subtotal + ipi_total - discountValue + (parseFloat(freight_value) || 0);

  const result = db.prepare(`INSERT INTO purchase_orders (order_number, supplier_id, supplier_name, supplier_cnpj, supplier_phone, supplier_email, supplier_address, supplier_contact,
    payment_type, payment_condition, freight_type, carrier, freight_value, delivery_deadline, notes, status, subtotal, ipi_total, total, created_by, buyer_name, delivery_address, discount_percent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`).run(
    order_number, supplier_id || null, supplier_name, supplier_cnpj || '', supplier_phone || '', supplier_email || '', supplier_address || '', supplier_contact || '',
    payment_type || 'vista', payment_condition || '', freight_type || 'included', carrier || '', parseFloat(freight_value) || 0, delivery_deadline || '', notes || '',
    subtotal, ipi_total, total, req.user.id, buyer_name || '', delivery_address || '', discountPct
  );

  const orderId = result.lastInsertRowid;
  for (const item of items) {
    const qty = item.quantity || 1;
    const price = item.unit_price || 0;
    const itemTotal = qty * price;
    const ipiPct = item.ipi_percent || 0;
    const ipiVal = itemTotal * (ipiPct / 100);
    db.prepare(`INSERT INTO purchase_order_items (order_id, description, quantity, unit, unit_price, ipi_percent, ipi_value, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(orderId, item.description, qty, item.unit || 'un', price, ipiPct, ipiVal, itemTotal + ipiVal);
  }

  for (const item of items) {
    try {
      db.prepare('INSERT INTO price_history (supplier_name, supplier_id, item_description, unit_price, date, source, source_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        supplier_name, supplier_id || null, item.description, item.unit_price || 0, new Date().toISOString().split('T')[0], 'purchase_order', orderId
      );
    } catch (_) {}
  }

  logActivity(req.user.id, req.user.email, 'create', 'purchase_order', orderId, `Criou OC ${order_number} - ${supplier_name}`);
  res.status(201).json({ id: orderId, order_number });
});

router.put('/:id', (req, res) => {
  const { supplier_id, supplier_name, supplier_cnpj, supplier_phone, supplier_email, supplier_address, supplier_contact,
    payment_type, payment_condition, freight_type, carrier, freight_value, delivery_deadline, notes, status, items, buyer_name, delivery_address, discount_percent } = req.body;

  const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Ordem não encontrada' });

  const discountPct = parseFloat(discount_percent) || 0;
  let subtotal = 0;
  let ipi_total = 0;
  if (items) {
    for (const item of items) {
      const itemTotal = (item.quantity || 1) * (item.unit_price || 0);
      const ipiVal = itemTotal * ((item.ipi_percent || 0) / 100);
      subtotal += itemTotal;
      ipi_total += ipiVal;
    }
  }
  const discountValue = (subtotal + ipi_total) * (discountPct / 100);
  const total = subtotal + ipi_total - discountValue + (parseFloat(freight_value) || 0);

  db.prepare(`UPDATE purchase_orders SET supplier_id=?, supplier_name=?, supplier_cnpj=?, supplier_phone=?, supplier_email=?, supplier_address=?, supplier_contact=?,
    payment_type=?, payment_condition=?, freight_type=?, carrier=?, freight_value=?, delivery_deadline=?, notes=?, status=?,
    subtotal=?, ipi_total=?, total=?, buyer_name=?, delivery_address=?, discount_percent=? WHERE id=?`).run(
    supplier_id || null, supplier_name || order.supplier_name, supplier_cnpj || '', supplier_phone || '', supplier_email || '', supplier_address || '', supplier_contact || '',
    payment_type || 'vista', payment_condition || '', freight_type || 'included', carrier || '', parseFloat(freight_value) || 0, delivery_deadline || '', notes || '',
    status || order.status, subtotal, ipi_total, total, buyer_name || '', delivery_address || '', discountPct, req.params.id
  );

  if (items) {
    db.prepare('DELETE FROM purchase_order_items WHERE order_id = ?').run(req.params.id);
    for (const item of items) {
      const qty = item.quantity || 1;
      const price = item.unit_price || 0;
      const itemTotal = qty * price;
      const ipiPct = item.ipi_percent || 0;
      const ipiVal = itemTotal * (ipiPct / 100);
      db.prepare(`INSERT INTO purchase_order_items (order_id, description, quantity, unit, unit_price, ipi_percent, ipi_value, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(req.params.id, item.description, qty, item.unit || 'un', price, ipiPct, ipiVal, itemTotal + ipiVal);
    }
  }

  res.json({ success: true });
});

router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status é obrigatório' });
  const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Ordem não encontrada' });
  db.prepare('UPDATE purchase_orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM purchase_order_items WHERE order_id = ?').run(req.params.id);
  db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/:id/pdf', (req, res) => {
  const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Ordem não encontrada' });
  const items = db.prepare('SELECT * FROM purchase_order_items WHERE order_id = ?').all(order.id);
  const company = db.prepare('SELECT * FROM company_settings WHERE id = 1').get() || {};

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${order.order_number}.pdf"`);
  doc.pipe(res);

  const pageW = doc.page.width - 80;
  const blue = '#1e40af';
  const gray = '#6b7280';
  const dark = '#111827';

  const arialPath = 'C:/Windows/Fonts/arial.ttf';
  const arialBoldPath = 'C:/Windows/Fonts/arialbd.ttf';
  if (existsSync(arialPath)) {
    doc.registerFont('Regular', arialPath);
    doc.registerFont('Bold', existsSync(arialBoldPath) ? arialBoldPath : arialPath);
  } else {
    doc.registerFont('Regular', 'Helvetica');
    doc.registerFont('Bold', 'Helvetica-Bold');
  }

  // Header
  const headerH = 80;
  doc.rect(40, 40, pageW, headerH).fill('#f0f4ff');

  let logoEndX = 55;
  if (company.logo_base64 && company.logo_base64.startsWith('data:image')) {
    try {
      const base64Data = company.logo_base64.split(',')[1];
      const imgBuffer = Buffer.from(base64Data, 'base64');
      doc.image(imgBuffer, 50, 48, { height: 40, width: 100 });
      logoEndX = 160;
    } catch (_) {}
  }

  doc.fillColor(blue).fontSize(18).font('Bold').text('ORDEM DE COMPRA', logoEndX, 52);
  doc.fillColor(dark).fontSize(11).font('Regular').text(order.order_number, logoEndX, 74);
  doc.fillColor(gray).fontSize(9).text(`Data: ${new Date(order.created_at).toLocaleDateString('pt-BR')}`, pageW - 60, 55, { width: 100 });
  const statusLabel = { draft: 'Rascunho', sent: 'Enviada', confirmed: 'Confirmada', cancelled: 'Cancelada' };
  doc.text(`Status: ${statusLabel[order.status] || order.status}`, pageW - 60, 70, { width: 100 });

  let y = 140;

  // Company info
  doc.fillColor(blue).fontSize(10).font('Bold').text('DADOS DA EMPRESA', 55, y);
  y += 16;
  doc.fillColor(dark).fontSize(9).font('Regular');
  if (company.name) { doc.text(company.name, 55, y); y += 13; }
  if (company.trade_name) { doc.text(`Nome Fantasia: ${company.trade_name}`, 55, y); y += 13; }
  if (company.cnpj) { doc.text(`CNPJ: ${company.cnpj}`, 55, y); y += 13; }
  if (company.ie) { doc.text(`IE: ${company.ie}`, 55, y); y += 13; }
  if (company.address) { doc.text(`${company.address}${company.city ? ' - ' + company.city : ''}${company.state ? '/' + company.state : ''}${company.zip ? ' - CEP: ' + company.zip : ''}`, 55, y); y += 13; }
  if (company.phone || company.email) { doc.text(`${company.phone ? 'Tel: ' + company.phone : ''}${company.phone && company.email ? ' | ' : ''}${company.email ? 'Email: ' + company.email : ''}`, 55, y); y += 13; }
  if (order.buyer_name) { doc.font('Bold').text(`Comprador: `, 55, y, { continued: true }); doc.font('Regular').text(order.buyer_name); y += 13; }
  if (company.nfe_email) {
    doc.font('Bold').fillColor('#b91c1c').text(`Envio de NF-e: `, 55, y, { continued: true });
    doc.font('Regular').text(company.nfe_email);
    doc.fillColor(dark);
    y += 13;
  }

  y += 8;
  doc.moveTo(55, y).lineTo(pageW + 25, y).strokeColor('#e5e7eb').stroke();
  y += 12;

  // Supplier info
  doc.fillColor(blue).fontSize(10).font('Bold').text('FORNECEDOR', 55, y);
  y += 16;
  doc.fillColor(dark).fontSize(9).font('Regular');
  doc.text(order.supplier_name, 55, y); y += 13;
  if (order.supplier_cnpj) { doc.text(`CNPJ: ${order.supplier_cnpj}`, 55, y); y += 13; }
  if (order.supplier_address) { doc.text(`Endereço: ${order.supplier_address}`, 55, y); y += 13; }
  if (order.supplier_phone) { doc.text(`Tel: ${order.supplier_phone}`, 55, y); y += 13; }
  if (order.supplier_email) { doc.text(`Email: ${order.supplier_email}`, 55, y); y += 13; }
  if (order.supplier_contact) { doc.text(`Contato: ${order.supplier_contact}`, 55, y); y += 13; }

  if (order.delivery_address) {
    y += 8;
    doc.moveTo(55, y).lineTo(pageW + 25, y).strokeColor('#e5e7eb').stroke();
    y += 12;
    doc.fillColor(blue).fontSize(10).font('Bold').text('ENDEREÇO DE ENTREGA', 55, y);
    y += 16;
    doc.fillColor(dark).fontSize(9).font('Regular');
    doc.text(order.delivery_address, 55, y, { width: pageW }); y += 13;
  }

  y += 8;
  doc.moveTo(55, y).lineTo(pageW + 25, y).strokeColor('#e5e7eb').stroke();
  y += 12;

  // Items table header
  doc.fillColor(blue).fontSize(10).font('Bold').text('ITENS', 55, y);
  y += 18;

  const cols = [
    { label: '#', x: 55, w: 25 },
    { label: 'Descrição', x: 80, w: 170 },
    { label: 'Qtd', x: 250, w: 40 },
    { label: 'Un', x: 290, w: 30 },
    { label: 'Vlr Unit.', x: 320, w: 70 },
    { label: 'IPI %', x: 390, w: 45 },
    { label: 'IPI R$', x: 435, w: 55 },
    { label: 'Total', x: 490, w: 65 },
  ];

  doc.rect(55, y, pageW, 18).fill('#1e40af');
  doc.fillColor('#ffffff').fontSize(8).font('Bold');
  for (const col of cols) {
    doc.text(col.label, col.x + 2, y + 4, { width: col.w - 4, align: col.label === 'Descrição' ? 'left' : 'right' });
  }
  y += 18;

  doc.font('Regular').fontSize(8).fillColor(dark);
  items.forEach((item, i) => {
    const descW = cols[1].w - 4;
    const descH = doc.heightOfString(item.description, { width: descW, fontSize: 8 });
    const rowH = Math.max(16, descH + 8);

    if (y + rowH > 720) {
      doc.addPage();
      y = 50;
    }
    const bg = i % 2 === 0 ? '#f9fafb' : '#ffffff';
    doc.rect(55, y, pageW, rowH).fill(bg);
    doc.fillColor(dark);
    const fmt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.text(String(i + 1), cols[0].x + 2, y + 4, { width: cols[0].w - 4, align: 'right' });
    doc.text(item.description, cols[1].x + 2, y + 4, { width: descW });
    doc.text(String(item.quantity), cols[2].x + 2, y + 4, { width: cols[2].w - 4, align: 'right' });
    doc.text(item.unit, cols[3].x + 2, y + 4, { width: cols[3].w - 4, align: 'right' });
    doc.text(fmt(item.unit_price), cols[4].x + 2, y + 4, { width: cols[4].w - 4, align: 'right' });
    doc.text(item.ipi_percent > 0 ? `${fmt(item.ipi_percent)}%` : '-', cols[5].x + 2, y + 4, { width: cols[5].w - 4, align: 'right' });
    doc.text(item.ipi_value > 0 ? fmt(item.ipi_value) : '-', cols[6].x + 2, y + 4, { width: cols[6].w - 4, align: 'right' });
    doc.text(fmt(item.total), cols[7].x + 2, y + 4, { width: cols[7].w - 4, align: 'right' });
    y += rowH;
  });

  // Totals
  y += 6;
  doc.moveTo(380, y).lineTo(pageW + 25, y).strokeColor('#e5e7eb').stroke();
  y += 8;
  const fmt2 = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.fontSize(9).font('Regular');
  doc.fillColor(gray).text('Subtotal:', 380, y, { width: 80, align: 'right' });
  doc.fillColor(dark).text(`R$ ${fmt2(order.subtotal)}`, 465, y, { width: 90, align: 'right' });
  y += 14;
  if (order.ipi_total > 0) {
    doc.fillColor(gray).text('IPI Total:', 380, y, { width: 80, align: 'right' });
    doc.fillColor(dark).text(`R$ ${fmt2(order.ipi_total)}`, 465, y, { width: 90, align: 'right' });
    y += 14;
  }
  if (order.discount_percent > 0) {
    const discountVal = (order.subtotal + order.ipi_total) * (order.discount_percent / 100);
    doc.fillColor('#16a34a').text(`Desconto (${fmt2(order.discount_percent)}%):`, 350, y, { width: 110, align: 'right' });
    doc.text(`-R$ ${fmt2(discountVal)}`, 465, y, { width: 90, align: 'right' });
    doc.fillColor(dark);
    y += 14;
  }
  if (order.freight_value > 0) {
    doc.fillColor(gray).text('Frete:', 380, y, { width: 80, align: 'right' });
    doc.fillColor(dark).text(`R$ ${fmt2(order.freight_value)}`, 465, y, { width: 90, align: 'right' });
    y += 14;
  }
  doc.rect(380, y - 2, pageW - 325, 20).fill('#f0f4ff');
  doc.fillColor(blue).fontSize(11).font('Bold').text('TOTAL:', 385, y + 2, { width: 75, align: 'right' });
  doc.text(`R$ ${fmt2(order.total)}`, 465, y + 2, { width: 90, align: 'right' });
  y += 30;

  // Payment & Freight
  if (y > 680) { doc.addPage(); y = 50; }
  doc.moveTo(55, y).lineTo(pageW + 25, y).strokeColor('#e5e7eb').stroke();
  y += 12;

  doc.fillColor(blue).fontSize(10).font('Bold').text('CONDIÇÕES', 55, y);
  y += 18;
  doc.fillColor(dark).fontSize(9).font('Regular');

  const payLabels = { vista: 'À Vista', credito: 'Cartão de Crédito', faturamento: 'Faturamento' };
  let payText = `Pagamento: ${payLabels[order.payment_type] || order.payment_type}`;
  if (order.payment_type === 'faturamento' && order.payment_condition) payText += ` — ${order.payment_condition}`;
  doc.text(payText, 55, y); y += 14;

  const freightLabels = { included: 'Frete Incluso (CIF)', fob: 'FOB (por conta do comprador)', cif: 'CIF (por conta do vendedor)' };
  let freightText = `Frete: ${freightLabels[order.freight_type] || order.freight_type}`;
  if (order.freight_type === 'fob' && order.carrier) freightText += ` — Transportadora: ${order.carrier}`;
  doc.text(freightText, 55, y); y += 14;

  if (order.delivery_deadline) {
    doc.text(`Prazo de Entrega: ${order.delivery_deadline}`, 55, y); y += 14;
  }

  if (order.notes) {
    y += 6;
    doc.fillColor(blue).fontSize(10).font('Bold').text('OBSERVAÇÕES', 55, y);
    y += 16;
    doc.fillColor(dark).fontSize(9).font('Regular').text(order.notes, 55, y, { width: pageW });
  }

  doc.end();
});

export default router;
