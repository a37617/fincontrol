import { Router } from 'express';
import db from '../database.js';

const router = Router();

function lastBusinessDay(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const date = new Date(year, month - 1, lastDay);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  }
  return date.toISOString().split('T')[0];
}

function adjustToNextBusinessDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  if (day === 6) date.setDate(date.getDate() + 2);
  else if (day === 0) date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

router.get('/', async (req, res) => {
  const plans = await db.prepare(`
    SELECT ip.*, c.name as category_name, c.color as category_color,
      (SELECT COUNT(*) FROM bills WHERE installment_plan_id = ip.id) as total_bills,
      (SELECT COUNT(*) FROM bills WHERE installment_plan_id = ip.id AND status = 'paid') as paid_bills,
      (SELECT COALESCE(SUM(amount),0) FROM bills WHERE installment_plan_id = ip.id AND status = 'paid') as paid_amount,
      (SELECT COALESCE(SUM(amount),0) FROM bills WHERE installment_plan_id = ip.id AND status != 'paid') as remaining_amount,
      (SELECT amount FROM bills WHERE installment_plan_id = ip.id AND status != 'paid' ORDER BY due_date ASC LIMIT 1) as next_bill_amount
    FROM installment_plans ip
    LEFT JOIN categories c ON ip.category_id = c.id
    ORDER BY ip.status ASC, ip.created_at DESC
  `).all();
  res.json(plans);
});

router.get('/:id', async (req, res) => {
  const plan = await db.prepare(`
    SELECT ip.*, c.name as category_name, c.color as category_color
    FROM installment_plans ip
    LEFT JOIN categories c ON ip.category_id = c.id
    WHERE ip.id = ?
  `).get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Parcelamento não encontrado' });

  const bills = await db.prepare(`
    SELECT b.*, ba.bank_name
    FROM bills b
    LEFT JOIN bank_accounts ba ON b.bank_account_id = ba.id
    WHERE b.installment_plan_id = ?
    ORDER BY b.installment_number ASC
  `).all(req.params.id);

  const paid = bills.filter(b => b.status === 'paid').length;
  res.json({ ...plan, bills, paid_count: paid, remaining_count: bills.length - paid });
});

router.post('/', async (req, res) => {
  const { description, creditor, total_amount, total_installments, category_id, notes, first_due_date, first_installment_date, entry_amount, entry_installments, due_type, entry_due_type } = req.body;
  const isLastBizDay = due_type === 'last_business_day';
  const isEntryLastBizDay = entry_due_type === 'last_business_day';
  if (!description || !total_amount || !total_installments || !first_due_date) {
    return res.status(400).json({ error: 'Descrição, valor total, número de parcelas e data do primeiro vencimento são obrigatórios' });
  }

  const hasEntry = entry_amount && entry_amount > 0;
  const entryParcels = hasEntry ? (entry_installments || 1) : 0;
  const entryPerParcel = hasEntry ? entry_amount / entryParcels : 0;
  const remaining = hasEntry ? total_amount - entry_amount : total_amount;
  const amount_per = remaining / total_installments;
  const totalBills = entryParcels + total_installments;

  const result = await db.prepare(`INSERT INTO installment_plans (description, creditor, total_amount, total_installments, category_id, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(description, creditor || null, total_amount, totalBills, category_id || null, notes || null, req.user.id);

  const planId = result.lastInsertRowid;
  const [entryYear, entryMonth, entryDay] = first_due_date.split('-').map(Number);

  for (let i = 0; i < entryParcels; i++) {
    const m = entryMonth + i;
    const y = entryYear + Math.floor((m - 1) / 12);
    const mAdj = ((m - 1) % 12) + 1;
    const dueDateStr = isEntryLastBizDay ? lastBusinessDay(y, mAdj) : adjustToNextBusinessDay(new Date(entryYear, entryMonth - 1 + i, entryDay).toISOString().split('T')[0]);
    const label = entryParcels === 1
      ? `${description} - Entrada`
      : `${description} - Entrada ${i + 1}/${entryParcels}`;
    await db.prepare(`INSERT INTO bills (description, supplier, amount, due_date, status, category_id, installment_plan_id, installment_number, notes, created_by)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`).run(
      label, creditor || null, entryPerParcel, dueDateStr, category_id || null,
      planId, 0, notes || null, req.user.id
    );
  }

  const installDate = hasEntry && first_installment_date ? first_installment_date : first_due_date;
  const [instYear, instMonth, instDay] = installDate.split('-').map(Number);

  for (let i = 0; i < total_installments; i++) {
    const m = instMonth + i;
    const y = instYear + Math.floor((m - 1) / 12);
    const mAdj = ((m - 1) % 12) + 1;
    const dueDateStr = isLastBizDay ? lastBusinessDay(y, mAdj) : adjustToNextBusinessDay(new Date(instYear, instMonth - 1 + i, instDay).toISOString().split('T')[0]);
    await db.prepare(`INSERT INTO bills (description, supplier, amount, due_date, status, category_id, installment_plan_id, installment_number, notes, created_by)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`).run(
      `${description} - Parcela ${i + 1}/${total_installments}`,
      creditor || null, amount_per, dueDateStr, category_id || null,
      planId, i + 1, notes || null, req.user.id
    );
  }

  res.status(201).json({ id: planId, installments_created: totalBills });
});

router.put('/:id', async (req, res) => {
  const { status, notes } = req.body;
  if (status === 'settled') {
    await db.prepare("UPDATE installment_plans SET status = 'settled' WHERE id = ?").run(req.params.id);
    await db.prepare("UPDATE bills SET status = 'paid', payment_date = ? WHERE installment_plan_id = ? AND status != 'paid'")
      .run(new Date().toISOString().split('T')[0], req.params.id);
  } else if (status === 'active') {
    await db.prepare("UPDATE installment_plans SET status = 'active' WHERE id = ?").run(req.params.id);
  }
  if (notes !== undefined) {
    await db.prepare("UPDATE installment_plans SET notes = ? WHERE id = ?").run(notes, req.params.id);
  }
  res.json({ success: true });
});

router.put('/:id/bills/:billId', async (req, res) => {
  const { due_date, amount } = req.body;
  const bill = await db.prepare("SELECT * FROM bills WHERE id = ? AND installment_plan_id = ?").get(req.params.billId, req.params.id);
  if (!bill) return res.status(404).json({ error: 'Parcela não encontrada' });
  if (due_date) await db.prepare("UPDATE bills SET due_date = ? WHERE id = ?").run(due_date, req.params.billId);
  if (amount !== undefined) await db.prepare("UPDATE bills SET amount = ? WHERE id = ?").run(amount, req.params.billId);
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  const force = req.query.force === 'true';
  if (force) {
    await db.prepare("DELETE FROM bills WHERE installment_plan_id = ?").run(req.params.id);
    await db.prepare("DELETE FROM installment_plans WHERE id = ?").run(req.params.id);
  } else {
    await db.prepare("DELETE FROM bills WHERE installment_plan_id = ? AND status != 'paid'").run(req.params.id);
    const remaining = await db.prepare("SELECT COUNT(*) as c FROM bills WHERE installment_plan_id = ?").get(req.params.id);
    if (remaining.c === 0) {
      await db.prepare("DELETE FROM installment_plans WHERE id = ?").run(req.params.id);
    } else {
      await db.prepare("UPDATE installment_plans SET status = 'settled' WHERE id = ?").run(req.params.id);
    }
  }
  res.json({ success: true });
});

export default router;
