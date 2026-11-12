import { Router } from 'express';
import db from '../database.js';

const router = Router();

const INCOME_CATEGORIES = ['Vendas', 'Serviços', 'Recebimento de Clientes', 'Empréstimos', 'Reembolsos', 'Juros/Rendimentos', 'Outros'];

router.get('/categories', (req, res) => {
  res.json(INCOME_CATEGORIES);
});

router.get('/', (req, res) => {
  const { period, start_date, end_date, search, category } = req.query;
  let sql = `SELECT i.*, ba.bank_name, ba.account_number
    FROM incomes i
    LEFT JOIN bank_accounts ba ON i.bank_account_id = ba.id WHERE 1=1`;
  const params = [];

  if (search) { sql += ' AND (i.description LIKE ? OR i.source LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (category) { sql += ' AND i.category = ?'; params.push(category); }

  const today = new Date().toISOString().split('T')[0];
  if (period === 'day') {
    sql += ' AND i.date = ?'; params.push(today);
  } else if (period === 'week') {
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
    sql += ' AND i.date BETWEEN ? AND ?'; params.push(today, weekEnd.toISOString().split('T')[0]);
  } else if (period === 'month') {
    const monthStart = today.slice(0, 7) + '-01';
    const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1); nextMonth.setDate(0);
    sql += ' AND i.date BETWEEN ? AND ?'; params.push(monthStart, nextMonth.toISOString().split('T')[0]);
  } else if (start_date && end_date) {
    sql += ' AND i.date BETWEEN ? AND ?'; params.push(start_date, end_date);
  }

  sql += ' ORDER BY i.date DESC, i.amount DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/summary', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';
  const monthEndDate = new Date(); monthEndDate.setMonth(monthEndDate.getMonth() + 1); monthEndDate.setDate(0);
  const monthEnd = monthEndDate.toISOString().split('T')[0];

  const todayTotal = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM incomes WHERE date = ?").get(today);
  const monthTotal = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM incomes WHERE date BETWEEN ? AND ?").get(monthStart, monthEnd);
  const pending = db.prepare("SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM incomes WHERE status = 'expected'").get();

  res.json({ today: todayTotal.total, month: monthTotal.total, pending: pending.total, pending_count: pending.count });
});

router.post('/', (req, res) => {
  const { description, source, amount, date, category, bank_account_id, notes, status } = req.body;
  if (!description || !amount || !date) return res.status(400).json({ error: 'Descrição, valor e data são obrigatórios' });

  const incomeStatus = status || 'received';
  const result = db.prepare(`INSERT INTO incomes (description, source, amount, date, category, bank_account_id, notes, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    description, source || null, amount, date, category || 'Outros', bank_account_id || null, notes || null, incomeStatus, req.user.id
  );

  if (incomeStatus === 'received' && bank_account_id) {
    db.prepare('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?').run(amount, bank_account_id);
  }

  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { description, source, amount, date, category, bank_account_id, notes } = req.body;
  db.prepare(`UPDATE incomes SET description = COALESCE(?, description), source = COALESCE(?, source), amount = COALESCE(?, amount), date = COALESCE(?, date), category = COALESCE(?, category), bank_account_id = COALESCE(?, bank_account_id), notes = COALESCE(?, notes) WHERE id = ?`)
    .run(description, source, amount, date, category, bank_account_id, notes, req.params.id);
  res.json({ success: true });
});

router.post('/:id/receive', (req, res) => {
  const { bank_account_id } = req.body;
  if (!bank_account_id) return res.status(400).json({ error: 'Selecione a conta bancária' });

  const income = db.prepare('SELECT * FROM incomes WHERE id = ?').get(req.params.id);
  if (!income) return res.status(404).json({ error: 'Entrada não encontrada' });
  if (income.status === 'received') return res.status(400).json({ error: 'Entrada já recebida' });

  db.prepare("UPDATE incomes SET status = 'received', bank_account_id = ?, date = ? WHERE id = ?")
    .run(bank_account_id, new Date().toISOString().split('T')[0], req.params.id);
  db.prepare('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?').run(income.amount, bank_account_id);

  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const income = db.prepare('SELECT * FROM incomes WHERE id = ?').get(req.params.id);
  if (income && income.status === 'received' && income.bank_account_id) {
    db.prepare('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?').run(income.amount, income.bank_account_id);
  }
  db.prepare('DELETE FROM incomes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
