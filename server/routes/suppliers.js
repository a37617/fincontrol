import { Router } from 'express';
import db from '../database.js';

const router = Router();

router.get('/', (req, res) => {
  const { search } = req.query;
  let sql = 'SELECT * FROM suppliers WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (name LIKE ? OR trade_name LIKE ? OR cnpj LIKE ? OR product_category LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ' ORDER BY name ASC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Fornecedor não encontrado' });
  res.json(supplier);
});

router.post('/', (req, res) => {
  const { name, trade_name, cnpj, phone, email, contact_person, address, city, state, notes, product_category } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
  const result = db.prepare(`INSERT INTO suppliers (name, trade_name, cnpj, phone, email, contact_person, address, city, state, notes, product_category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    name, trade_name || null, cnpj || null, phone || null, email || null, contact_person || null, address || null, city || null, state || null, notes || null, product_category || null
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { name, trade_name, cnpj, phone, email, contact_person, address, city, state, notes, product_category } = req.body;
  db.prepare(`UPDATE suppliers SET name = COALESCE(?, name), trade_name = ?, cnpj = ?, phone = ?, email = ?, contact_person = ?, address = ?, city = ?, state = ?, notes = ?, product_category = ? WHERE id = ?`)
    .run(name, trade_name || null, cnpj || null, phone || null, email || null, contact_person || null, address || null, city || null, state || null, notes || null, product_category || null, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
