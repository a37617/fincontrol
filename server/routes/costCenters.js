import { Router } from 'express';
import db from '../database.js';

const router = Router();

router.get('/', (req, res) => {
  const centers = db.prepare(`
    SELECT cc.*, COALESCE(SUM(cci.amount), 0) as total_spent,
    COUNT(cci.id) as items_count
    FROM cost_centers cc
    LEFT JOIN cost_center_items cci ON cc.id = cci.cost_center_id
    GROUP BY cc.id ORDER BY cc.created_at DESC
  `).all();
  res.json(centers);
});

router.get('/:id', (req, res) => {
  const center = db.prepare('SELECT * FROM cost_centers WHERE id = ?').get(req.params.id);
  if (!center) return res.status(404).json({ error: 'Centro de custos não encontrado' });

  const items = db.prepare(`
    SELECT cci.*, b.supplier, b.nfe_number, b.due_date
    FROM cost_center_items cci
    LEFT JOIN bills b ON cci.bill_id = b.id
    WHERE cci.cost_center_id = ?
    ORDER BY cci.created_at DESC
  `).all(req.params.id);

  const totalMaterial = items.filter(i => i.type === 'material').reduce((s, i) => s + i.amount, 0);
  const totalMob = items.filter(i => i.type === 'mob').reduce((s, i) => s + i.amount, 0);
  const totalSpent = totalMaterial + totalMob;
  const contracted = center.contracted_value || center.budget || 0;
  const margin = contracted > 0 ? contracted - totalSpent : 0;
  const marginPct = contracted > 0 ? ((margin / contracted) * 100) : 0;

  res.json({ ...center, items, total_material: totalMaterial, total_mob: totalMob, total: totalSpent, margin, margin_pct: marginPct });
});

router.post('/', (req, res) => {
  const { name, description, budget, type, os_number, nf_remessa, repair_type, promised_deadline, actual_delivery, contracted_value } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
  const result = db.prepare(`INSERT INTO cost_centers (name, description, budget, type, os_number, nf_remessa, repair_type, promised_deadline, actual_delivery, contracted_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    name, description || '', budget || 0, type || 'service',
    os_number || '', nf_remessa || '', repair_type || '',
    promised_deadline || '', actual_delivery || '', contracted_value || 0
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.post('/:id/items', (req, res) => {
  const { description, amount, type, bill_id, quantity, unit } = req.body;
  if (!description || !amount) return res.status(400).json({ error: 'Descrição e valor são obrigatórios' });
  const result = db.prepare('INSERT INTO cost_center_items (cost_center_id, bill_id, description, amount, type) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.id, bill_id || null, description, amount, type || 'material');
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { name, description, budget, status, os_number, nf_remessa, repair_type, promised_deadline, actual_delivery, contracted_value } = req.body;
  db.prepare(`UPDATE cost_centers SET
    name = COALESCE(?, name), description = COALESCE(?, description), budget = COALESCE(?, budget),
    status = COALESCE(?, status), os_number = COALESCE(?, os_number), nf_remessa = COALESCE(?, nf_remessa),
    repair_type = COALESCE(?, repair_type), promised_deadline = COALESCE(?, promised_deadline),
    actual_delivery = COALESCE(?, actual_delivery), contracted_value = COALESCE(?, contracted_value)
    WHERE id = ?`)
    .run(name, description, budget, status, os_number, nf_remessa, repair_type, promised_deadline, actual_delivery, contracted_value, req.params.id);
  res.json({ success: true });
});

router.delete('/:id/items/:itemId', (req, res) => {
  db.prepare('DELETE FROM cost_center_items WHERE id = ? AND cost_center_id = ?').run(req.params.itemId, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM cost_center_items WHERE cost_center_id = ?').run(req.params.id);
  db.prepare('DELETE FROM cost_centers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
