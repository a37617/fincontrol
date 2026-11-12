import { Router } from 'express';
import { XMLParser } from 'fast-xml-parser';
import multer from 'multer';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import db from '../database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsDir = join(__dirname, '..', 'uploads');
mkdirSync(uploadsDir, { recursive: true });

const router = Router();
const upload = multer({ dest: uploadsDir });

function parseNfe(xmlContent) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });
  const parsed = parser.parse(xmlContent);

  const nfe = parsed.nfeProc?.NFe || parsed.NFe || parsed.enviNFe?.NFe;
  if (!nfe) throw new Error('XML não é uma NF-e válida. Tags encontradas: ' + Object.keys(parsed).join(', '));

  const infNFe = nfe.infNFe;
  const ide = infNFe.ide;
  const emit = infNFe.emit;
  const total = infNFe.total?.ICMSTot;
  const cobr = infNFe.cobr;
  const det = infNFe.det;

  const supplier = emit?.xNome || emit?.xFant || 'Fornecedor não identificado';
  const nfeNumber = String(ide?.nNF || '');
  const totalValue = parseFloat(total?.vNF || 0);

  const products = [];
  const items = Array.isArray(det) ? det : det ? [det] : [];
  for (const item of items) {
    const prod = item.prod;
    if (!prod) continue;
    products.push({
      name: prod.xProd || 'Produto sem nome',
      code: prod.cProd || '',
      unit: prod.uCom || 'un',
      quantity: parseFloat(prod.qCom || 0),
      unit_cost: parseFloat(prod.vUnCom || 0),
      total: parseFloat(prod.vProd || 0),
    });
  }

  const installments = [];
  if (cobr?.dup) {
    const dups = Array.isArray(cobr.dup) ? cobr.dup : [cobr.dup];
    for (const dup of dups) {
      installments.push({
        number: dup.nDup || '',
        due_date: dup.dVenc || '',
        amount: parseFloat(dup.vDup || 0),
      });
    }
  }

  if (installments.length === 0 && totalValue > 0) {
    const today = new Date().toISOString().split('T')[0];
    installments.push({ number: '001', due_date: today, amount: totalValue });
  }

  return { supplier, nfeNumber, totalValue, products, installments };
}

router.post('/parse', upload.single('xml'), (req, res) => {
  try {
    let xmlContent;
    if (req.file) {
      xmlContent = readFileSync(req.file.path, 'utf-8');
    } else if (req.body.xml) {
      xmlContent = req.body.xml;
    } else {
      return res.status(400).json({ error: 'Envie um arquivo XML' });
    }
    const result = parseNfe(xmlContent);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: 'Erro ao processar XML: ' + e.message });
  }
});

router.post('/import', (req, res) => {
  const { supplier, nfeNumber, products, installments, category_id, cost_center_id } = req.body;

  const billIds = [];
  const inventoryIds = [];

  const insertBill = db.prepare(`INSERT INTO bills (description, supplier, amount, due_date, status, category_id, cost_center_id, nfe_number, created_by) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`);
  const insertInventory = db.prepare('INSERT INTO inventory (name, category, unit, quantity, unit_cost, total_cost, supplier, nfe_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET quantity = quantity + excluded.quantity, total_cost = total_cost + excluded.total_cost, unit_cost = (total_cost + excluded.total_cost) / (quantity + excluded.quantity), updated_at = CURRENT_TIMESTAMP');
  const insertMovement = db.prepare('INSERT INTO inventory_movements (inventory_id, type, quantity, unit_cost, notes) VALUES (?, ?, ?, ?, ?)');

  const transaction = db.transaction(() => {
    for (const inst of installments) {
      const desc = `NF ${nfeNumber} - Parcela ${inst.number}`;
      const result = insertBill.run(desc, supplier, inst.amount, inst.due_date, category_id || null, cost_center_id || null, nfeNumber, req.user.id);
      billIds.push(result.lastInsertRowid);

      if (cost_center_id) {
        db.prepare('INSERT INTO cost_center_items (cost_center_id, bill_id, description, amount, type) VALUES (?, ?, ?, ?, ?)')
          .run(cost_center_id, result.lastInsertRowid, desc, inst.amount, 'material');
      }
    }

    for (const prod of products) {
      const existing = db.prepare('SELECT id FROM inventory WHERE name = ? AND supplier = ?').get(prod.name, supplier);
      if (existing) {
        const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(existing.id);
        const newQty = item.quantity + prod.quantity;
        const newTotal = item.total_cost + prod.total;
        const newUnitCost = newQty > 0 ? newTotal / newQty : 0;
        db.prepare('UPDATE inventory SET quantity = ?, unit_cost = ?, total_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newQty, newUnitCost, newTotal, existing.id);
        insertMovement.run(existing.id, 'in', prod.quantity, prod.unit_cost, `NF ${nfeNumber}`);
        inventoryIds.push(existing.id);
      } else {
        const result = db.prepare('INSERT INTO inventory (name, category, unit, quantity, unit_cost, total_cost, supplier, nfe_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(prod.name, '', prod.unit, prod.quantity, prod.unit_cost, prod.total, supplier, nfeNumber);
        insertMovement.run(result.lastInsertRowid, 'in', prod.quantity, prod.unit_cost, `NF ${nfeNumber}`);
        inventoryIds.push(result.lastInsertRowid);
      }
    }
  });

  try {
    transaction();
    res.status(201).json({ bills_created: billIds.length, inventory_updated: inventoryIds.length, bill_ids: billIds, inventory_ids: inventoryIds });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao importar: ' + e.message });
  }
});

export default router;
