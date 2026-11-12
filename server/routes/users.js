import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../database.js';

const router = Router();

router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC').all();
  res.json(users);
});

router.post('/', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email já cadastrado' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name, email, hash, role || 'user');
  res.status(201).json({ id: result.lastInsertRowid, name, email, role: role || 'user' });
});

router.put('/:id', (req, res) => {
  const { name, email, password, role } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  if (email && email !== user.email) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.params.id);
    if (existing) return res.status(409).json({ error: 'Email já em uso' });
  }

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET name = ?, email = ?, password_hash = ?, role = ? WHERE id = ?')
      .run(name || user.name, email || user.email, hash, role || user.role, req.params.id);
  } else {
    db.prepare('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?')
      .run(name || user.name, email || user.email, role || user.role, req.params.id);
  }
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Não é possível excluir seu próprio usuário' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
