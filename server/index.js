import express from 'express';
import cors from 'cors';
import { initDatabase } from './database.js';
import { authMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import categoriesRoutes from './routes/categories.js';
import bankAccountsRoutes from './routes/bankAccounts.js';
import billsRoutes from './routes/bills.js';
import paymentsRoutes from './routes/payments.js';
import costCentersRoutes from './routes/costCenters.js';
import inventoryRoutes from './routes/inventory.js';
import nfeRoutes from './routes/nfe.js';
import dashboardRoutes from './routes/dashboard.js';
import installmentsRoutes from './routes/installments.js';
import usersRoutes from './routes/users.js';
import incomesRoutes from './routes/incomes.js';
import suppliersRoutes from './routes/suppliers.js';
import purchaseTabsRoutes from './routes/purchaseTabs.js';
import purchaseOrdersRoutes from './routes/purchaseOrders.js';
import attachmentsRoutes from './routes/attachments.js';
import priceHistoryRoutes from './routes/priceHistory.js';
import activityLogRoutes from './routes/activityLog.js';
import backupRoutes from './routes/backup.js';
import recurringRoutes from './routes/recurring.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

await initDatabase();

app.use('/api/auth', (req, res, next) => {
  if (req.path === '/login' || req.path === '/register') return next();
  authMiddleware(req, res, next);
}, authRoutes);

app.use('/api/categories', authMiddleware, categoriesRoutes);
app.use('/api/bank-accounts', authMiddleware, bankAccountsRoutes);
app.use('/api/bills', authMiddleware, billsRoutes);
app.use('/api/payments', authMiddleware, paymentsRoutes);
app.use('/api/cost-centers', authMiddleware, costCentersRoutes);
app.use('/api/inventory', authMiddleware, inventoryRoutes);
app.use('/api/nfe', authMiddleware, nfeRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/installments', authMiddleware, installmentsRoutes);
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/incomes', authMiddleware, incomesRoutes);
app.use('/api/suppliers', authMiddleware, suppliersRoutes);
app.use('/api/purchase-tabs', authMiddleware, purchaseTabsRoutes);
app.use('/api/purchase-orders', authMiddleware, purchaseOrdersRoutes);
app.use('/api/attachments', authMiddleware, attachmentsRoutes);
app.use('/api/price-history', authMiddleware, priceHistoryRoutes);
app.use('/api/activity-log', authMiddleware, activityLogRoutes);
app.use('/api/backup', authMiddleware, backupRoutes);
app.use('/api/recurring', authMiddleware, recurringRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`FinControl API rodando em http://localhost:${PORT}`);
});
