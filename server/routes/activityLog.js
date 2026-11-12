import { Router } from 'express';
import db from '../database.js';

const router = Router();

export function logActivity(userId, userName, action, entityType, entityId, details) {
  try {
    db.prepare('INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)').run(
      userId || null, userName || '', action, entityType, entityId || null, details || ''
    );
  } catch (_) {}
}

router.get('/', (req, res) => {
  const { limit, offset, entity_type } = req.query;
  let sql = 'SELECT * FROM activity_log';
  const params = [];

  if (entity_type) { sql += ' WHERE entity_type = ?'; params.push(entity_type); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit) || 50, parseInt(offset) || 0);

  const logs = db.prepare(sql).all(...params);
  const total = db.prepare(`SELECT COUNT(*) as count FROM activity_log${entity_type ? ' WHERE entity_type = ?' : ''}`).get(...(entity_type ? [entity_type] : []));
  res.json({ logs, total: total.count });
});

export default router;
