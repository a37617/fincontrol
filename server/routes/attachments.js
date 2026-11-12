import { Router } from 'express';
import db from '../database.js';

const router = Router();

router.get('/bill/:billId', (req, res) => {
  const attachments = db.prepare('SELECT id, bill_id, filename, content_type, uploaded_at FROM bill_attachments WHERE bill_id = ? ORDER BY uploaded_at DESC').all(req.params.billId);
  res.json(attachments);
});

router.post('/bill/:billId', (req, res) => {
  const { filename, content_type, file_data } = req.body;
  if (!filename || !file_data) return res.status(400).json({ error: 'Arquivo obrigatório' });

  const maxSize = 5 * 1024 * 1024;
  const dataSize = Buffer.byteLength(file_data, 'utf8') * 0.75;
  if (dataSize > maxSize) return res.status(400).json({ error: 'Arquivo muito grande (máx 5MB)' });

  const result = db.prepare('INSERT INTO bill_attachments (bill_id, filename, content_type, file_data) VALUES (?, ?, ?, ?)').run(
    req.params.billId, filename, content_type || '', file_data
  );
  res.status(201).json({ id: result.lastInsertRowid, filename });
});

router.get('/:id/download', (req, res) => {
  const att = db.prepare('SELECT * FROM bill_attachments WHERE id = ?').get(req.params.id);
  if (!att) return res.status(404).json({ error: 'Anexo não encontrado' });

  const base64Data = att.file_data.includes(',') ? att.file_data.split(',')[1] : att.file_data;
  const buffer = Buffer.from(base64Data, 'base64');
  res.setHeader('Content-Type', att.content_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${att.filename}"`);
  res.send(buffer);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM bill_attachments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
