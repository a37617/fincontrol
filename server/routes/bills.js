import { Router } from 'express';
import db from '../database.js';
import { logActivity } from './activityLog.js';
import { autoGenerateRecurring } from './recurring.js';

const router = Router();

router.get('/', async (req, res) => {
  await autoGenerateRecurring(req.user?.id);
  const { status, category_id, period, start_date, end_date, cost_center_id, search } = req.query;
  let sql = `SELECT b.*, c.name as category_name, c.color as category_color, ba.bank_name, ba.account_number, cc.name as cost_center_name,
    ip.description as plan_description, ip.total_installments as plan_total
    FROM bills b
    LEFT JOIN categories c ON b.category_id = c.id
    LEFT JOIN bank_accounts ba ON b.bank_account_id = ba.id
    LEFT JOIN cost_centers cc ON b.cost_center_id = cc.id
    LEFT JOIN installment_plans ip ON b.installment_plan_id = ip.id WHERE 1=1`;
  const params = [];

  if (status) { sql += ' AND b.status = ?'; params.push(status); }
  if (category_id) { sql += ' AND b.category_id = ?'; params.push(category_id); }
  if (cost_center_id) { sql += ' AND b.cost_center_id = ?'; params.push(cost_center_id); }
  if (search) { sql += ' AND (b.description LIKE ? OR b.supplier LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  const today = new Date().toISOString().split('T')[0];
  if (period === 'day') {
    sql += ' AND b.due_date = ?'; params.push(today);
  } else if (period === 'week') {
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
    sql += ' AND b.due_date BETWEEN ? AND ?'; params.push(today, weekEnd.toISOString().split('T')[0]);
  } else if (period === 'month') {
    const monthStart = today.slice(0, 7) + '-01';
    const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1); nextMonth.setDate(0);
    sql += ' AND b.due_date BETWEEN ? AND ?'; params.push(monthStart, nextMonth.toISOString().split('T')[0]);
  } else if (start_date && end_date) {
    sql += ' AND b.due_date BETWEEN ? AND ?'; params.push(start_date, end_date);
  }

  sql += ' ORDER BY b.due_date ASC, b.amount DESC';
  const bills = await db.prepare(sql).all(...params);

  const today2 = new Date().toISOString().split('T')[0];
  for (const bill of bills) {
    if (bill.status === 'pending' && bill.due_date < today2) bill.status = 'overdue';
  }

  res.json(bills);
});

router.get('/summary', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  const monthStart = today.slice(0, 7) + '-01';
  const monthEndDate = new Date(); monthEndDate.setMonth(monthEndDate.getMonth() + 1); monthEndDate.setDate(0);
  const monthEnd = monthEndDate.toISOString().split('T')[0];

  const todayTotal = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE due_date = ? AND status != 'paid'").get(today);
  const weekTotal = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE due_date BETWEEN ? AND ? AND status != 'paid'").get(today, weekEnd.toISOString().split('T')[0]);
  const monthTotal = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE due_date BETWEEN ? AND ? AND status != 'paid'").get(monthStart, monthEnd);
  const paidMonth = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE payment_date BETWEEN ? AND ? AND status = 'paid'").get(monthStart, monthEnd);
  const overdueTotal = await db.prepare("SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM bills WHERE due_date < ? AND status = 'pending'").get(today);
  const todayAlerts = await db.prepare("SELECT * FROM bills WHERE due_date = ? AND status != 'paid' ORDER BY amount DESC").all(today);

  res.json({
    today: todayTotal.total,
    week: weekTotal.total,
    month: monthTotal.total,
    paid_month: paidMonth.total,
    overdue: overdueTotal.total,
    overdue_count: overdueTotal.count,
    alerts: todayAlerts
  });
});

router.get('/:id', async (req, res) => {
  const bill = await db.prepare(`SELECT b.*, c.name as category_name, ba.bank_name, cc.name as cost_center_name
    FROM bills b LEFT JOIN categories c ON b.category_id = c.id
    LEFT JOIN bank_accounts ba ON b.bank_account_id = ba.id
    LEFT JOIN cost_centers cc ON b.cost_center_id = cc.id
    WHERE b.id = ?`).get(req.params.id);
  if (!bill) return res.status(404).json({ error: 'Conta não encontrada' });
  res.json(bill);
});

router.post('/', async (req, res) => {
  const { description, supplier, amount, due_date, category_id, cost_center_id, nfe_number, is_recurring, recurring_day, notes, paid_at_sight, bank_account_id, payment_method, payment_source, value_type } = req.body;
  if (!description || !amount || !due_date) return res.status(400).json({ error: 'Descrição, valor e vencimento são obrigatórios' });

  const status = paid_at_sight ? 'paid' : 'pending';
  const payment_date = paid_at_sight ? new Date().toISOString().split('T')[0] : null;

  const result = await db.prepare(`INSERT INTO bills (description, supplier, amount, due_date, status, category_id, bank_account_id, cost_center_id, nfe_number, is_recurring, recurring_day, payment_date, payment_method, paid_at_sight, notes, created_by, payment_source, value_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    description, supplier || '', amount, due_date, status, category_id || null, paid_at_sight ? (bank_account_id || null) : null,
    cost_center_id || null, nfe_number || null, is_recurring ? 1 : 0, recurring_day || null, payment_date, payment_method || null, paid_at_sight ? 1 : 0, notes || null, req.user.id, payment_source || '', value_type || 'fixed'
  );

  if (paid_at_sight && bank_account_id) {
    await db.prepare('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?').run(amount, bank_account_id);
  }

  if (cost_center_id) {
    await db.prepare('INSERT INTO cost_center_items (cost_center_id, bill_id, description, amount, type) VALUES (?, ?, ?, ?, ?)').run(cost_center_id, result.lastInsertRowid, description, amount, 'material');
  }

  await logActivity(req.user.id, req.user.email, 'create', 'bill', result.lastInsertRowid, `Criou conta: ${description} - R$ ${amount}`);
  res.status(201).json({ id: result.lastInsertRowid, status });
});

router.get('/:id/items', async (req, res) => {
  const items = await db.prepare('SELECT * FROM bill_items WHERE bill_id = ? ORDER BY id').all(req.params.id);
  res.json(items);
});

router.post('/:id/items', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items deve ser um array' });
  await db.prepare('DELETE FROM bill_items WHERE bill_id = ?').run(req.params.id);
  for (const item of items) {
    const qty = item.quantity || 1;
    const price = item.unit_price || 0;
    const total = Math.round(qty * price * 100) / 100;
    await db.prepare('INSERT INTO bill_items (bill_id, description, quantity, unit, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.params.id, item.description || '', qty, item.unit || 'un', price, total);
  }
  const saved = await db.prepare('SELECT * FROM bill_items WHERE bill_id = ? ORDER BY id').all(req.params.id);
  res.json(saved);
});

router.put('/:id', async (req, res) => {
  const { description, supplier, amount, due_date, category_id, cost_center_id, nfe_number, notes } = req.body;
  await db.prepare(`UPDATE bills SET description = COALESCE(?, description), supplier = COALESCE(?, supplier), amount = COALESCE(?, amount), due_date = COALESCE(?, due_date), category_id = COALESCE(?, category_id), cost_center_id = COALESCE(?, cost_center_id), nfe_number = COALESCE(?, nfe_number), notes = COALESCE(?, notes) WHERE id = ?`)
    .run(description ?? null, supplier ?? null, amount ?? null, due_date ?? null, category_id ?? null, cost_center_id ?? null, nfe_number ?? null, notes ?? null, req.params.id);
  res.json({ success: true });
});

router.post('/:id/reschedule', async (req, res) => {
  const { new_due_date } = req.body;
  if (!new_due_date) return res.status(400).json({ error: 'Nova data de vencimento é obrigatória' });
  const bill = await db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
  if (!bill) return res.status(404).json({ error: 'Conta não encontrada' });
  if (bill.status === 'paid') return res.status(400).json({ error: 'Conta já está paga' });

  await db.prepare('UPDATE bills SET due_date = ? WHERE id = ?').run(new_due_date, req.params.id);
  const [y1, m1, d1] = bill.due_date.split('-');
  const [y2, m2, d2] = new_due_date.split('-');
  await logActivity(req.user.id, req.user.email, 'update', 'bill', bill.id, `Reagendou conta: ${bill.description} de ${d1}/${m1}/${y1} para ${d2}/${m2}/${y2}`);
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM bill_items WHERE bill_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM cost_center_items WHERE bill_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM bills WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
