import { Router } from 'express';
import db from '../database.js';

const router = Router();

router.get('/', async (req, res) => {
  const { search } = req.query;
  let sql = 'SELECT * FROM suppliers WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (name LIKE ? OR trade_name LIKE ? OR cnpj LIKE ? OR product_category LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ' ORDER BY name ASC';
  res.json(await db.prepare(sql).all(...params));
});

router.get('/:id', async (req, res) => {
  const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Fornecedor não encontrado' });
  res.json(supplier);
});

router.get('/:id/history', async (req, res) => {
  const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Fornecedor não encontrado' });

  const namePattern = `%${supplier.name}%`;
  const bills = await db.prepare(
    `SELECT b.*, c.name as category_name FROM bills b LEFT JOIN categories c ON b.category_id = c.id
     WHERE b.supplier LIKE ? ORDER BY b.due_date DESC`
  ).all(namePattern);

  const purchaseOrders = await db.prepare(
    `SELECT * FROM purchase_orders WHERE supplier_id = ? OR supplier_name LIKE ? ORDER BY created_at DESC`
  ).all(supplier.id, namePattern);

  const purchaseTabs = await db.prepare(
    `SELECT * FROM purchase_tabs WHERE supplier_id = ? OR supplier_name LIKE ? ORDER BY created_at DESC`
  ).all(supplier.id, namePattern);

  const priceHistory = await db.prepare(
    `SELECT * FROM price_history WHERE supplier_id = ? OR supplier_name LIKE ? ORDER BY date DESC`
  ).all(supplier.id, namePattern);

  const totals = {
    total_bills: bills.length,
    total_amount: bills.reduce((s, b) => s + (b.amount || 0), 0),
    total_paid: bills.filter(b => b.status === 'paid').reduce((s, b) => s + (b.amount || 0), 0),
    total_pending: bills.filter(b => b.status !== 'paid').reduce((s, b) => s + (b.amount || 0), 0),
  };

  res.json({ supplier, bills, purchaseOrders, purchaseTabs, priceHistory, totals });
});

router.post('/', async (req, res) => {
  const { name, trade_name, cnpj, phone, email, contact_person, address, city, state, notes, product_category } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
  const result = await db.prepare(`INSERT INTO suppliers (name, trade_name, cnpj, phone, email, contact_person, address, city, state, notes, product_category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    name, trade_name || null, cnpj || null, phone || null, email || null, contact_person || null, address || null, city || null, state || null, notes || null, product_category || null
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', async (req, res) => {
  const { name, trade_name, cnpj, phone, email, contact_person, address, city, state, notes, product_category } = req.body;
  await db.prepare(`UPDATE suppliers SET name = COALESCE(?, name), trade_name = ?, cnpj = ?, phone = ?, email = ?, contact_person = ?, address = ?, city = ?, state = ?, notes = ?, product_category = ? WHERE id = ?`)
    .run(name, trade_name || null, cnpj || null, phone || null, email || null, contact_person || null, address || null, city || null, state || null, notes || null, product_category || null, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
