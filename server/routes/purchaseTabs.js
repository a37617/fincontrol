import { Router } from 'express';
import db from '../database.js';

const router = Router();

router.get('/', (req, res) => {
  const tabs = db.prepare(`
    SELECT pt.*,
      (SELECT COALESCE(SUM(total), 0) FROM purchase_tab_items WHERE tab_id = pt.id) as total_amount,
      (SELECT COUNT(*) FROM purchase_tab_items WHERE tab_id = pt.id) as item_count
    FROM purchase_tabs pt
    ORDER BY pt.status ASC, pt.month DESC, pt.created_at DESC
  `).all();
  res.json(tabs);
});

router.get('/:id', (req, res) => {
  const tab = db.prepare('SELECT * FROM purchase_tabs WHERE id = ?').get(req.params.id);
  if (!tab) return res.status(404).json({ error: 'Vale não encontrado' });
  const items = db.prepare('SELECT * FROM purchase_tab_items WHERE tab_id = ? ORDER BY purchase_date DESC, created_at DESC').all(req.params.id);
  const total = items.reduce((s, i) => s + i.total, 0);
  res.json({ ...tab, items, total_amount: total });
});

router.post('/', (req, res) => {
  const { supplier_name, supplier_id, month, notes } = req.body;
  if (!supplier_name || !month) return res.status(400).json({ error: 'Fornecedor e mês são obrigatórios' });
  const result = db.prepare('INSERT INTO purchase_tabs (supplier_name, supplier_id, month, notes, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(supplier_name, supplier_id || null, month, notes || null, req.user.id);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.post('/:id/items', (req, res) => {
  const { description, quantity, unit, unit_price, purchase_date, notes } = req.body;
  if (!description) return res.status(400).json({ error: 'Descrição é obrigatória' });
  const qty = parseFloat(quantity) || 1;
  const price = parseFloat(unit_price) || 0;
  const total = qty * price;
  const result = db.prepare('INSERT INTO purchase_tab_items (tab_id, description, quantity, unit, unit_price, total, purchase_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(req.params.id, description, qty, unit || 'un', price, total, purchase_date || new Date().toISOString().split('T')[0], notes || null);
  res.status(201).json({ id: result.lastInsertRowid, total });
});

router.put('/:id/items/:itemId', (req, res) => {
  const { description, quantity, unit, unit_price, purchase_date, notes } = req.body;
  const qty = parseFloat(quantity) || 1;
  const price = parseFloat(unit_price) || 0;
  const total = qty * price;
  db.prepare('UPDATE purchase_tab_items SET description = ?, quantity = ?, unit = ?, unit_price = ?, total = ?, purchase_date = ?, notes = ? WHERE id = ? AND tab_id = ?')
    .run(description, qty, unit || 'un', price, total, purchase_date, notes || null, req.params.itemId, req.params.id);
  res.json({ success: true, total });
});

router.delete('/:id/items/:itemId', (req, res) => {
  db.prepare('DELETE FROM purchase_tab_items WHERE id = ? AND tab_id = ?').run(req.params.itemId, req.params.id);
  res.json({ success: true });
});

router.post('/:id/generate-bill', (req, res) => {
  const { due_date, category_id, cost_center_id, payment_source } = req.body;
  if (!due_date) return res.status(400).json({ error: 'Data de vencimento é obrigatória' });

  const tab = db.prepare('SELECT * FROM purchase_tabs WHERE id = ?').get(req.params.id);
  if (!tab) return res.status(404).json({ error: 'Vale não encontrado' });

  const items = db.prepare('SELECT * FROM purchase_tab_items WHERE tab_id = ?').all(req.params.id);
  const total = items.reduce((s, i) => s + i.total, 0);

  if (total <= 0) return res.status(400).json({ error: 'Vale sem itens ou valor zerado' });

  const itemList = items.map(i => `${i.description} (${i.quantity}x)`).join(', ');
  const desc = `Vale ${tab.supplier_name} - ${tab.month}`;
  const notesText = `Itens: ${itemList}${tab.notes ? '\n' + tab.notes : ''}`;

  const result = db.prepare(`INSERT INTO bills (description, supplier, amount, due_date, status, category_id, cost_center_id, payment_source, notes, created_by)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`).run(
    desc, tab.supplier_name, total, due_date, category_id || null, cost_center_id || null, payment_source || '', notesText, req.user.id
  );

  db.prepare("UPDATE purchase_tabs SET status = 'closed' WHERE id = ?").run(req.params.id);

  res.status(201).json({ bill_id: result.lastInsertRowid, total, description: desc });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM purchase_tab_items WHERE tab_id = ?').run(req.params.id);
  db.prepare('DELETE FROM purchase_tabs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
