import { Router } from 'express';
import db from '../database.js';

const router = Router();

router.get('/download', async (req, res) => {
  try {
    const tables = ['users', 'categories', 'bank_accounts', 'bills', 'bill_items', 'cost_centers', 'cost_center_items', 'inventory', 'inventory_movements', 'suppliers', 'incomes', 'recurring_bills', 'installment_plans', 'purchase_tabs', 'purchase_tab_items', 'company_settings', 'purchase_orders', 'purchase_order_items', 'bill_attachments', 'price_history', 'activity_log'];
    const data = {};
    for (const table of tables) {
      data[table] = await db.prepare(`SELECT * FROM ${table}`).all();
    }
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="fincontrol-backup-${date}.json"`);
    res.send(JSON.stringify(data, null, 2));
  } catch (e) {
    res.status(500).json({ error: 'Erro ao gerar backup' });
  }
});

export default router;
