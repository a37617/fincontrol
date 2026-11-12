import { Router } from 'express';
import db from '../database.js';
import { autoGenerateRecurring } from './recurring.js';

const router = Router();

router.get('/kpis', async (req, res) => {
  await autoGenerateRecurring(req.user?.id);
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const todayDue = (await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE due_date = ? AND status != 'paid'").get(today)).total;
  const weekDue = (await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE due_date BETWEEN ? AND ? AND status != 'paid'").get(today, weekEnd)).total;
  const monthDue = (await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE due_date BETWEEN ? AND ? AND status != 'paid'").get(monthStart, monthEnd)).total;
  const monthPaid = (await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE payment_date BETWEEN ? AND ? AND status = 'paid'").get(monthStart, monthEnd)).total;
  const overdue = await db.prepare("SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM bills WHERE due_date < ? AND status = 'pending'").get(today);
  const totalAccounts = (await db.prepare("SELECT COALESCE(SUM(balance),0) as total FROM bank_accounts").get()).total;

  let monthIncome = 0;
  try {
    monthIncome = (await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM incomes WHERE date BETWEEN ? AND ? AND status = 'received'").get(monthStart, monthEnd)).total;
  } catch (e) {}

  res.json({
    today_due: todayDue,
    week_due: weekDue,
    month_due: monthDue,
    month_paid: monthPaid,
    month_income: monthIncome,
    overdue_total: overdue.total,
    overdue_count: overdue.count,
    bank_balance: totalAccounts,
    forecast_balance: totalAccounts - monthDue + monthIncome
  });
});

router.get('/alerts', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const todayBills = await db.prepare(`
    SELECT b.*, c.name as category_name, c.color as category_color
    FROM bills b LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.due_date = ? AND b.status != 'paid'
    ORDER BY b.amount DESC
  `).all(today);

  const tomorrowBills = await db.prepare(`
    SELECT b.*, c.name as category_name, c.color as category_color
    FROM bills b LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.due_date = ? AND b.status != 'paid'
    ORDER BY b.amount DESC
  `).all(tomorrow);

  const weekBills = await db.prepare(`
    SELECT b.*, c.name as category_name, c.color as category_color
    FROM bills b LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.due_date > ? AND b.due_date <= ? AND b.status != 'paid'
    ORDER BY b.due_date ASC, b.amount DESC
  `).all(tomorrow, weekEnd);

  const overdue = await db.prepare(`
    SELECT b.*, c.name as category_name, c.color as category_color
    FROM bills b LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.due_date < ? AND b.status = 'pending'
    ORDER BY b.due_date ASC LIMIT 20
  `).all(today);

  res.json({ today: todayBills, tomorrow: tomorrowBills, week: weekBills, overdue });
});

router.get('/dre', async (req, res) => {
  const { months } = req.query;
  const m = parseInt(months) || 6;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - m);
  const start = startDate.toISOString().split('T')[0];

  const expenses = await db.prepare(`
    SELECT TO_CHAR(due_date::date, 'YYYY-MM') as month, SUM(amount) as total
    FROM bills WHERE due_date >= ? GROUP BY TO_CHAR(due_date::date, 'YYYY-MM') ORDER BY month
  `).all(start);

  let incomes = [];
  try {
    incomes = await db.prepare(`
      SELECT TO_CHAR(date::date, 'YYYY-MM') as month, SUM(amount) as total
      FROM incomes WHERE date >= ? AND status = 'received' GROUP BY TO_CHAR(date::date, 'YYYY-MM') ORDER BY month
    `).all(start);
  } catch (_) {}

  const months_set = new Set();
  expenses.forEach(e => months_set.add(e.month));
  incomes.forEach(i => months_set.add(i.month));

  const result = Array.from(months_set).sort().map(month => {
    const exp = expenses.find(e => e.month === month)?.total || 0;
    const inc = incomes.find(i => i.month === month)?.total || 0;
    return { month, receitas: inc, despesas: exp, resultado: inc - exp };
  });

  res.json(result);
});

router.get('/cashflow-daily', async (req, res) => {
  const { days } = req.query;
  const d = parseInt(days) || 90;
  const today = new Date();
  const balance = (await db.prepare("SELECT COALESCE(SUM(balance),0) as total FROM bank_accounts").get()).total;

  const result = [];
  let running = balance;

  for (let i = 0; i < d; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const dayExpenses = (await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE due_date = ? AND status != 'paid'").get(dateStr)).total;
    let dayIncomes = 0;
    try {
      dayIncomes = (await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM incomes WHERE date = ? AND status = 'received'").get(dateStr)).total;
    } catch (_) {}

    running = running + dayIncomes - dayExpenses;
    result.push({ date: dateStr, expenses: dayExpenses, incomes: dayIncomes, balance: running });
  }

  res.json({ initial_balance: balance, daily: result });
});

router.get('/budget-vs-actual', async (req, res) => {
  const monthStart = new Date().toISOString().slice(0, 7) + '-01';
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

  const categories = await db.prepare(`
    SELECT c.id, c.name, c.color, c.budget,
      COALESCE(SUM(CASE WHEN b.due_date BETWEEN ? AND ? THEN b.amount ELSE 0 END), 0) as actual
    FROM categories c LEFT JOIN bills b ON b.category_id = c.id
    GROUP BY c.id, c.name, c.color, c.budget ORDER BY c.name
  `).all(monthStart, monthEnd);

  res.json(categories.filter(c => c.budget > 0 || c.actual > 0));
});

router.get('/expenses-by-category', async (req, res) => {
  const { months } = req.query;
  const m = parseInt(months) || 6;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - m);

  const data = await db.prepare(`
    SELECT c.name, c.color, COALESCE(SUM(b.amount), 0) as total
    FROM bills b JOIN categories c ON b.category_id = c.id
    WHERE b.due_date >= ? GROUP BY c.id, c.name, c.color ORDER BY total DESC
  `).all(startDate.toISOString().split('T')[0]);

  res.json(data);
});

router.get('/monthly-trend', async (req, res) => {
  const data = await db.prepare(`
    SELECT TO_CHAR(due_date::date, 'YYYY-MM') as month,
      SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid,
      SUM(CASE WHEN status != 'paid' THEN amount ELSE 0 END) as pending,
      SUM(amount) as total
    FROM bills
    WHERE due_date >= (CURRENT_DATE - INTERVAL '6 months')::text
    GROUP BY TO_CHAR(due_date::date, 'YYYY-MM')
    ORDER BY month
  `).all();

  res.json(data);
});

router.get('/top-expenses', async (req, res) => {
  const data = await db.prepare(`
    SELECT c.name, c.color, SUM(b.amount) as total, COUNT(b.id) as count
    FROM bills b JOIN categories c ON b.category_id = c.id
    WHERE b.due_date >= (CURRENT_DATE - INTERVAL '3 months')::text
    GROUP BY c.id, c.name, c.color ORDER BY total DESC LIMIT 5
  `).all();
  res.json(data);
});

router.get('/cash-forecast', async (req, res) => {
  const monthlyAvg = await db.prepare(`
    SELECT TO_CHAR(due_date::date, 'YYYY-MM') as month, SUM(amount) as total
    FROM bills WHERE due_date >= (CURRENT_DATE - INTERVAL '6 months')::text AND due_date < CURRENT_DATE::text
    GROUP BY TO_CHAR(due_date::date, 'YYYY-MM')
  `).all();

  const avg = monthlyAvg.length > 0 ? monthlyAvg.reduce((s, m) => s + m.total, 0) / monthlyAvg.length : 0;
  const balance = (await db.prepare("SELECT COALESCE(SUM(balance),0) as total FROM bank_accounts").get()).total;

  const forecast = [];
  let runningBalance = balance;
  for (let i = 1; i <= 3; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    const month = d.toISOString().slice(0, 7);
    const scheduled = (await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE TO_CHAR(due_date::date, 'YYYY-MM') = ? AND status != 'paid'").get(month)).total;
    const estimated = Math.max(scheduled, avg);
    runningBalance -= estimated;
    forecast.push({ month, estimated_expense: estimated, scheduled, projected_balance: runningBalance });
  }

  res.json({ current_balance: balance, monthly_average: avg, forecast });
});

router.get('/category-breakdown', async (req, res) => {
  const { type } = req.query;
  const categoryMap = {
    operational: ['Salários', 'Aluguel', 'Energia / Água / Internet', 'Insumos de Escritório', 'Manutenção'],
    debts: [],
    investments: ['Investimentos'],
    taxes: ['Impostos'],
  };

  let data;
  if (type && categoryMap[type]) {
    const cats = categoryMap[type];
    if (cats.length === 0) {
      data = await db.prepare(`
        SELECT TO_CHAR(b.due_date::date, 'YYYY-MM') as month, SUM(b.amount) as total
        FROM bills b WHERE b.due_date >= (CURRENT_DATE - INTERVAL '6 months')::text
        GROUP BY TO_CHAR(b.due_date::date, 'YYYY-MM') ORDER BY month
      `).all();
    } else {
      const placeholders = cats.map(() => '?').join(',');
      data = await db.prepare(`
        SELECT TO_CHAR(b.due_date::date, 'YYYY-MM') as month, c.name as category, SUM(b.amount) as total
        FROM bills b JOIN categories c ON b.category_id = c.id
        WHERE c.name IN (${placeholders}) AND b.due_date >= (CURRENT_DATE - INTERVAL '6 months')::text
        GROUP BY TO_CHAR(b.due_date::date, 'YYYY-MM'), c.name ORDER BY month
      `).all(...cats);
    }
  } else {
    data = await db.prepare(`
      SELECT TO_CHAR(b.due_date::date, 'YYYY-MM') as month, c.name as category, c.color, SUM(b.amount) as total
      FROM bills b JOIN categories c ON b.category_id = c.id
      WHERE b.due_date >= (CURRENT_DATE - INTERVAL '6 months')::text
      GROUP BY TO_CHAR(b.due_date::date, 'YYYY-MM'), c.name, c.color ORDER BY month
    `).all();
  }

  res.json(data);
});

export default router;
