import { Router } from 'express';
import db from '../database.js';

const router = Router();

router.get('/', async (req, res) => {
  const { supplier_name, supplier_id, item } = req.query;
  let sql = 'SELECT * FROM price_history WHERE 1=1';
  const params = [];

  if (supplier_id) { sql += ' AND supplier_id = ?'; params.push(supplier_id); }
  else if (supplier_name) { sql += ' AND supplier_name LIKE ?'; params.push(`%${supplier_name}%`); }
  if (item) { sql += ' AND item_description LIKE ?'; params.push(`%${item}%`); }

  sql += ' ORDER BY date DESC LIMIT 100';
  res.json(await db.prepare(sql).all(...params));
});

router.get('/supplier/:id', async (req, res) => {
  const history = await db.prepare(`
    SELECT item_description, unit_price, date, source
    FROM price_history WHERE supplier_id = ?
    ORDER BY item_description, date DESC
  `).all(req.params.id);

  const grouped = {};
  for (const row of history) {
    if (!grouped[row.item_description]) grouped[row.item_description] = [];
    grouped[row.item_description].push(row);
  }
  res.json(grouped);
});

router.get('/item', async (req, res) => {
  const { description } = req.query;
  if (!description) return res.json([]);
  const history = await db.prepare(`
    SELECT supplier_name, unit_price, date, source
    FROM price_history WHERE item_description LIKE ?
    ORDER BY date DESC LIMIT 20
  `).all(`%${description}%`);
  res.json(history);
});

router.post('/', async (req, res) => {
  const { supplier_name, supplier_id, item_description, unit_price, date, source, source_id } = req.body;
  if (!supplier_name || !item_description || unit_price == null) return res.status(400).json({ error: 'Campos obrigatórios' });

  const result = await db.prepare('INSERT INTO price_history (supplier_name, supplier_id, item_description, unit_price, date, source, source_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    supplier_name, supplier_id || null, item_description, unit_price, date || new Date().toISOString().split('T')[0], source || 'manual', source_id || null
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

export default router;
