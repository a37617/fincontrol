import { Router } from 'express';
import db from '../database.js';

const router = Router();

router.get('/', async (req, res) => {
  const categories = await db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.json(categories);
});

router.post('/', async (req, res) => {
  const { name, type, color, icon, budget } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
  try {
    const result = await db.prepare('INSERT INTO categories (name, type, color, icon, budget) VALUES (?, ?, ?, ?, ?)').run(name, type || 'expense', color || '#3b82f6', icon || 'tag', budget || 0);
    res.status(201).json({ id: result.lastInsertRowid, name, type: type || 'expense', color: color || '#3b82f6', icon: icon || 'tag', budget: budget || 0 });
  } catch (e) {
    if (e.message.includes('UNIQUE') || e.message.includes('unique') || e.message.includes('duplicate')) return res.status(409).json({ error: 'Categoria já existe' });
    throw e;
  }
});

router.put('/:id', async (req, res) => {
  const { name, type, color, icon, budget } = req.body;
  await db.prepare('UPDATE categories SET name = COALESCE(?, name), type = COALESCE(?, type), color = COALESCE(?, color), icon = COALESCE(?, icon), budget = COALESCE(?, budget) WHERE id = ?').run(name, type, color, icon, budget != null ? budget : null, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
