import { Router } from 'express';
import db from '../database.js';

const router = Router();

router.get('/', (req, res) => {
  const { search, low_stock } = req.query;
  let sql = 'SELECT * FROM inventory WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (name LIKE ? OR category LIKE ? OR supplier LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (low_stock === 'true') sql += ' AND quantity <= min_stock AND min_stock > 0';
  sql += ' ORDER BY name';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item não encontrado' });
  const movements = db.prepare('SELECT * FROM inventory_movements WHERE inventory_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ ...item, movements });
});

router.post('/', (req, res) => {
  const { name, category, unit, quantity, unit_cost, sale_price, supplier, nfe_number, min_stock, photo_url } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
  const total_cost = (quantity || 0) * (unit_cost || 0);
  const result = db.prepare('INSERT INTO inventory (name, category, unit, quantity, unit_cost, total_cost, supplier, nfe_number, min_stock, sale_price, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(name, category || '', unit || 'un', quantity || 0, unit_cost || 0, total_cost, supplier || '', nfe_number || '', min_stock || 0, sale_price || 0, photo_url || '');

  if (quantity > 0) {
    db.prepare('INSERT INTO inventory_movements (inventory_id, type, quantity, unit_cost, notes) VALUES (?, ?, ?, ?, ?)')
      .run(result.lastInsertRowid, 'in', quantity, unit_cost || 0, 'Entrada inicial');
  }

  res.status(201).json({ id: result.lastInsertRowid });
});

router.post('/:id/movement', (req, res) => {
  const { type, quantity, unit_cost, bill_id, notes } = req.body;
  if (!type || !quantity) return res.status(400).json({ error: 'Tipo e quantidade são obrigatórios' });

  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item não encontrado' });

  db.prepare('INSERT INTO inventory_movements (inventory_id, type, quantity, unit_cost, bill_id, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.params.id, type, quantity, unit_cost || 0, bill_id || null, notes || '');

  if (type === 'in') {
    const totalQty = item.quantity + quantity;
    const totalCost = item.total_cost + (quantity * (unit_cost || 0));
    const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
    db.prepare('UPDATE inventory SET quantity = ?, unit_cost = ?, total_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(totalQty, avgCost, totalCost, req.params.id);
  } else {
    const newQty = Math.max(0, item.quantity - quantity);
    const newTotal = newQty * item.unit_cost;
    db.prepare('UPDATE inventory SET quantity = ?, total_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newQty, newTotal, req.params.id);
  }

  res.json({ success: true });
});

router.put('/:id', (req, res) => {
  const { name, category, unit, min_stock, sale_price, photo_url } = req.body;
  db.prepare('UPDATE inventory SET name = COALESCE(?, name), category = COALESCE(?, category), unit = COALESCE(?, unit), min_stock = COALESCE(?, min_stock), sale_price = COALESCE(?, sale_price), photo_url = COALESCE(?, photo_url), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(name, category, unit, min_stock, sale_price, photo_url, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM inventory_movements WHERE inventory_id = ?').run(req.params.id);
  db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
