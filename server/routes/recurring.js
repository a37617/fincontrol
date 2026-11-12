import { Router } from 'express';
import db from '../database.js';
import { logActivity } from './activityLog.js';

const router = Router();

export async function autoGenerateRecurring(userId) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const monthStr = String(m).padStart(2, '0');

  const templates = await db.prepare('SELECT * FROM recurring_bills').all();
  if (templates.length === 0) return 0;

  let generated = 0;
  for (const tpl of templates) {
    const existing = await db.prepare(
      "SELECT id FROM bills WHERE description = ? AND due_date LIKE ? AND is_recurring = 1"
    ).get(tpl.description, `${y}-${monthStr}-%`);
    if (existing) continue;

    let dueDate;
    if (tpl.due_day === 0) {
      const lastDay = new Date(y, m, 0).getDate();
      const d = new Date(y, m - 1, lastDay);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
      dueDate = d.toISOString().split('T')[0];
    } else {
      const day = Math.min(tpl.due_day, new Date(y, m, 0).getDate());
      dueDate = `${y}-${monthStr}-${String(day).padStart(2, '0')}`;
    }

    const amt = tpl.value_type === 'variable' ? 0 : tpl.amount;
    await db.prepare(
      `INSERT INTO bills (description, supplier, amount, due_date, status, category_id, is_recurring, recurring_day, payment_source, value_type, created_by)
       VALUES (?, ?, ?, ?, 'pending', ?, 1, ?, ?, ?, ?)`
    ).run(tpl.description, tpl.supplier || '', amt, dueDate, tpl.category_id || null, tpl.due_day, tpl.payment_source || '', tpl.value_type || 'fixed', userId || 1);
    generated++;
  }
  return generated;
}

router.get('/', async (req, res) => {
  const templates = await db.prepare(`
    SELECT rb.*, c.name as category_name, c.color as category_color
    FROM recurring_bills rb
    LEFT JOIN categories c ON rb.category_id = c.id
    ORDER BY rb.due_day ASC
  `).all();
  res.json(templates);
});

router.post('/', async (req, res) => {
  const { description, amount, due_day, category_id, supplier, value_type, payment_source } = req.body;
  if (!description) return res.status(400).json({ error: 'Descrição é obrigatória' });
  const result = await db.prepare(
    'INSERT INTO recurring_bills (description, amount, due_day, category_id, supplier, value_type) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(description, parseFloat(amount) || 0, due_day ?? 0, category_id || null, supplier || '', value_type || 'fixed');

  await db.prepare('UPDATE recurring_bills SET payment_source = ? WHERE id = ?').run(payment_source || '', result.lastInsertRowid);

  logActivity(req.user.id, req.user.email, 'create', 'bill', result.lastInsertRowid, `Criou conta fixa: ${description}`);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM recurring_bills WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/generate', async (req, res) => {
  const { year, month } = req.body;
  const y = year || new Date().getFullYear();
  const m = month || (new Date().getMonth() + 1);
  const monthStr = String(m).padStart(2, '0');

  const templates = await db.prepare('SELECT * FROM recurring_bills').all();
  if (templates.length === 0) return res.json({ generated: 0 });

  let generated = 0;
  for (const tpl of templates) {
    let dueDate;
    if (tpl.due_day === 0) {
      const lastDay = new Date(y, m, 0).getDate();
      const d = new Date(y, m - 1, lastDay);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
      dueDate = d.toISOString().split('T')[0];
    } else {
      const day = Math.min(tpl.due_day, new Date(y, m, 0).getDate());
      dueDate = `${y}-${monthStr}-${String(day).padStart(2, '0')}`;
    }

    const existing = await db.prepare(
      "SELECT id FROM bills WHERE description = ? AND due_date LIKE ? AND is_recurring = 1"
    ).get(tpl.description, `${y}-${monthStr}-%`);
    if (existing) continue;

    const amt = tpl.value_type === 'variable' ? 0 : tpl.amount;
    await db.prepare(
      `INSERT INTO bills (description, supplier, amount, due_date, status, category_id, is_recurring, recurring_day, payment_source, value_type, created_by)
       VALUES (?, ?, ?, ?, 'pending', ?, 1, ?, ?, ?, ?)`
    ).run(tpl.description, tpl.supplier || '', amt, dueDate, tpl.category_id || null, tpl.due_day, tpl.payment_source || '', tpl.value_type || 'fixed', req.user.id);
    generated++;
  }

  logActivity(req.user.id, req.user.email, 'create', 'bill', null, `Gerou ${generated} conta(s) fixa(s) para ${monthStr}/${y}`);
  res.json({ generated, month: `${monthStr}/${y}` });
});

export default router;
