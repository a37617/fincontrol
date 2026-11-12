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

router.post('/parse', upload.single('xml'), async (req, res) => {
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

router.post('/import', async (req, res) => {
  const { supplier, nfeNumber, products, installments, category_id, cost_center_id } = req.body;

  const billIds = [];
  const inventoryIds = [];

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    for (const inst of installments) {
      const desc = `NF ${nfeNumber} - Parcela ${inst.number}`;
      const result = await client.query(
        `INSERT INTO bills (description, supplier, amount, due_date, status, category_id, cost_center_id, nfe_number, created_by)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8) RETURNING id`,
        [desc, supplier, inst.amount, inst.due_date, category_id || null, cost_center_id || null, nfeNumber, req.user.id]
      );
      const billId = result.rows[0].id;
      billIds.push(billId);

      if (cost_center_id) {
        await client.query(
          'INSERT INTO cost_center_items (cost_center_id, bill_id, description, amount, type) VALUES ($1, $2, $3, $4, $5)',
          [cost_center_id, billId, desc, inst.amount, 'material']
        );
      }
    }

    for (const prod of products) {
      const existingResult = await client.query(
        'SELECT id FROM inventory WHERE name = $1 AND supplier = $2', [prod.name, supplier]
      );
      const existing = existingResult.rows[0];

      if (existing) {
        const itemResult = await client.query('SELECT * FROM inventory WHERE id = $1', [existing.id]);
        const item = itemResult.rows[0];
        const newQty = item.quantity + prod.quantity;
        const newTotal = item.total_cost + prod.total;
        const newUnitCost = newQty > 0 ? newTotal / newQty : 0;
        await client.query(
          'UPDATE inventory SET quantity = $1, unit_cost = $2, total_cost = $3, updated_at = NOW() WHERE id = $4',
          [newQty, newUnitCost, newTotal, existing.id]
        );
        await client.query(
          'INSERT INTO inventory_movements (inventory_id, type, quantity, unit_cost, notes) VALUES ($1, $2, $3, $4, $5)',
          [existing.id, 'in', prod.quantity, prod.unit_cost, `NF ${nfeNumber}`]
        );
        inventoryIds.push(existing.id);
      } else {
        const insResult = await client.query(
          'INSERT INTO inventory (name, category, unit, quantity, unit_cost, total_cost, supplier, nfe_number) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
          [prod.name, '', prod.unit, prod.quantity, prod.unit_cost, prod.total, supplier, nfeNumber]
        );
        const newId = insResult.rows[0].id;
        await client.query(
          'INSERT INTO inventory_movements (inventory_id, type, quantity, unit_cost, notes) VALUES ($1, $2, $3, $4, $5)',
          [newId, 'in', prod.quantity, prod.unit_cost, `NF ${nfeNumber}`]
        );
        inventoryIds.push(newId);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ bills_created: billIds.length, inventory_updated: inventoryIds.length, bill_ids: billIds, inventory_ids: inventoryIds });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Erro ao importar: ' + e.message });
  } finally {
    client.release();
  }
});

export default router;
