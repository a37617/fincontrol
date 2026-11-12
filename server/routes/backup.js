import { Router } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'fincontrol.db');

const router = Router();

router.get('/download', (req, res) => {
  try {
    const data = readFileSync(DB_PATH);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="fincontrol-backup-${date}.db"`);
    res.send(data);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao gerar backup' });
  }
});

export default router;
