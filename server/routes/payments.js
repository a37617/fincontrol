import { Router } from 'express';
import db from '../database.js';

const router = Router();

router.post('/:id/pay', async (req, res) => {
  const { bank_account_id, payment_method, payment_date } = req.body;

  const bill = await db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
  if (!bill) return res.status(404).json({ error: 'Conta não encontrada' });
  if (bill.status === 'paid') return res.status(400).json({ error: 'Conta já está paga' });

  const payDate = payment_date || new Date().toISOString().split('T')[0];

  await db.prepare('UPDATE bills SET status = ?, bank_account_id = ?, payment_method = ?, payment_date = ? WHERE id = ?')
    .run('paid', bank_account_id || null, payment_method || 'Dinheiro', payDate, req.params.id);

  if (bank_account_id) {
    await db.prepare('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?').run(bill.amount, bank_account_id);
  }

  res.json({ success: true, message: 'Pagamento registrado' });
});

router.post('/:id/unpay', async (req, res) => {
  const bill = await db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
  if (!bill) return res.status(404).json({ error: 'Conta não encontrada' });
  if (bill.status !== 'paid') return res.status(400).json({ error: 'Conta não está paga' });

  if (bill.bank_account_id) {
    await db.prepare('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?').run(bill.amount, bill.bank_account_id);
  }

  await db.prepare('UPDATE bills SET status = ?, bank_account_id = NULL, payment_method = NULL, payment_date = NULL WHERE id = ?')
    .run('pending', req.params.id);

  res.json({ success: true, message: 'Pagamento estornado' });
});

export default router;
