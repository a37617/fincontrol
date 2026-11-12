import { Router } from 'express';
import db from '../database.js';

const router = Router();

router.get('/', (req, res) => {
  const accounts = db.prepare('SELECT * FROM bank_accounts ORDER BY bank_name').all();
  res.json(accounts);
});

router.post('/', (req, res) => {
  const { bank_name, account_number, description, balance } = req.body;
  if (!bank_name || !account_number) return res.status(400).json({ error: 'Banco e número da conta são obrigatórios' });
  const result = db.prepare('INSERT INTO bank_accounts (bank_name, account_number, description, balance) VALUES (?, ?, ?, ?)').run(bank_name, account_number, description || '', balance || 0);
  res.status(201).json({ id: result.lastInsertRowid, bank_name, account_number, description, balance: balance || 0 });
});

router.put('/:id', (req, res) => {
  const { bank_name, account_number, description, balance } = req.body;
  db.prepare('UPDATE bank_accounts SET bank_name = COALESCE(?, bank_name), account_number = COALESCE(?, account_number), description = COALESCE(?, description), balance = COALESCE(?, balance) WHERE id = ?').run(bank_name, account_number, description, balance, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM bank_accounts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
