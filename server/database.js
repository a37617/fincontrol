import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, 'fincontrol.db');

let db;
let inTransaction = false;

function saveDb() {
  const data = db.export();
  writeFileSync(DB_PATH, Buffer.from(data));
}

setInterval(saveDb, 30000);
process.on('exit', () => { if (db) saveDb(); });
process.on('SIGINT', () => { if (db) saveDb(); process.exit(); });

const dbProxy = {
  prepare(sql) {
    return {
      run(...params) {
        db.run(sql, params);
        const lastId = db.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0];
        const changes = db.getRowsModified();
        if (!inTransaction) saveDb();
        return { lastInsertRowid: lastId, changes };
      },
      get(...params) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          stmt.free();
          const row = {};
          cols.forEach((c, i) => row[c] = vals[i]);
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const results = [];
        const stmt = db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          const row = {};
          cols.forEach((c, i) => row[c] = vals[i]);
          results.push(row);
        }
        stmt.free();
        return results;
      }
    };
  },
  exec(sql) {
    db.exec(sql);
    if (!inTransaction) saveDb();
  },
  transaction(fn) {
    return (...args) => {
      db.exec('BEGIN TRANSACTION');
      inTransaction = true;
      try {
        const result = fn(...args);
        inTransaction = false;
        db.exec('COMMIT');
        saveDb();
        return result;
      } catch (e) {
        inTransaction = false;
        try { db.exec('ROLLBACK'); } catch (_) {}
        throw e;
      }
    };
  }
};

export async function initDatabase() {
  const SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.exec("PRAGMA foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT DEFAULT 'expense',
      color TEXT DEFAULT '#3b82f6',
      icon TEXT DEFAULT 'tag',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      description TEXT,
      balance REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS cost_centers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      budget REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      supplier TEXT,
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      category_id INTEGER,
      bank_account_id INTEGER,
      cost_center_id INTEGER,
      nfe_number TEXT,
      is_recurring INTEGER DEFAULT 0,
      recurring_day INTEGER,
      payment_date TEXT,
      payment_method TEXT,
      paid_at_sight INTEGER DEFAULT 0,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS cost_center_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cost_center_id INTEGER NOT NULL,
      bill_id INTEGER,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT DEFAULT 'material',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT DEFAULT 'un',
      quantity REAL DEFAULT 0,
      unit_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      supplier TEXT,
      nfe_number TEXT,
      min_stock REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL DEFAULT 0,
      bill_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS recurring_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      due_day INTEGER NOT NULL,
      category_id INTEGER,
      supplier TEXT,
      value_type TEXT DEFAULT 'fixed',
      auto_generate INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS installment_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      creditor TEXT,
      total_amount REAL NOT NULL,
      total_installments INTEGER NOT NULL,
      category_id INTEGER,
      notes TEXT,
      status TEXT DEFAULT 'active',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      trade_name TEXT,
      cnpj TEXT,
      phone TEXT,
      email TEXT,
      contact_person TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      source TEXT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      category TEXT DEFAULT 'Outros',
      bank_account_id INTEGER,
      notes TEXT,
      status TEXT DEFAULT 'received',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_tabs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      supplier_id INTEGER,
      month TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS purchase_tab_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tab_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit TEXT DEFAULT 'un',
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0,
      purchase_date TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT '',
      trade_name TEXT DEFAULT '',
      cnpj TEXT DEFAULT '',
      ie TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      state TEXT DEFAULT '',
      zip TEXT DEFAULT '',
      logo_base64 TEXT DEFAULT ''
    );
    INSERT OR IGNORE INTO company_settings (id, name) VALUES (1, '');

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL,
      supplier_id INTEGER,
      supplier_name TEXT NOT NULL,
      supplier_cnpj TEXT DEFAULT '',
      supplier_phone TEXT DEFAULT '',
      supplier_email TEXT DEFAULT '',
      supplier_address TEXT DEFAULT '',
      supplier_contact TEXT DEFAULT '',
      payment_type TEXT DEFAULT 'vista',
      payment_condition TEXT DEFAULT '',
      freight_type TEXT DEFAULT 'included',
      carrier TEXT DEFAULT '',
      freight_value REAL DEFAULT 0,
      delivery_deadline TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      subtotal REAL DEFAULT 0,
      ipi_total REAL DEFAULT 0,
      total REAL DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit TEXT DEFAULT 'un',
      unit_price REAL DEFAULT 0,
      ipi_percent REAL DEFAULT 0,
      ipi_value REAL DEFAULT 0,
      total REAL DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES purchase_orders(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bill_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT DEFAULT '',
      file_data TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bill_id) REFERENCES bills(id)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      supplier_id INTEGER,
      item_description TEXT NOT NULL,
      unit_price REAL NOT NULL,
      date TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      source_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT DEFAULT '',
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations for existing databases
  const migrations = [
    "ALTER TABLE purchase_orders ADD COLUMN buyer_name TEXT DEFAULT ''",
    "ALTER TABLE purchase_orders ADD COLUMN delivery_address TEXT DEFAULT ''",
    "ALTER TABLE company_settings ADD COLUMN nfe_email TEXT DEFAULT ''",
    "ALTER TABLE bills ADD COLUMN payment_source TEXT DEFAULT ''",
    "ALTER TABLE bills ADD COLUMN installment_plan_id INTEGER",
    "ALTER TABLE bills ADD COLUMN installment_number INTEGER",
    "ALTER TABLE bills ADD COLUMN value_type TEXT DEFAULT 'fixed'",
    "ALTER TABLE inventory ADD COLUMN sale_price REAL DEFAULT 0",
    "ALTER TABLE inventory ADD COLUMN photo_url TEXT DEFAULT ''",
    "ALTER TABLE suppliers ADD COLUMN product_category TEXT DEFAULT ''",
    "ALTER TABLE cost_centers ADD COLUMN type TEXT DEFAULT 'service'",
    "ALTER TABLE cost_centers ADD COLUMN os_number TEXT DEFAULT ''",
    "ALTER TABLE cost_centers ADD COLUMN nf_remessa TEXT DEFAULT ''",
    "ALTER TABLE cost_centers ADD COLUMN repair_type TEXT DEFAULT ''",
    "ALTER TABLE cost_centers ADD COLUMN promised_deadline TEXT DEFAULT ''",
    "ALTER TABLE cost_centers ADD COLUMN actual_delivery TEXT DEFAULT ''",
    "ALTER TABLE cost_centers ADD COLUMN contracted_value REAL DEFAULT 0",
    "ALTER TABLE categories ADD COLUMN budget REAL DEFAULT 0",
    "ALTER TABLE recurring_bills ADD COLUMN payment_source TEXT DEFAULT ''",
    "ALTER TABLE recurring_bills ADD COLUMN value_type TEXT DEFAULT 'fixed'",
    "ALTER TABLE purchase_orders ADD COLUMN discount_percent REAL DEFAULT 0",
  ];

  db.exec(`
    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit TEXT DEFAULT 'un',
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bill_id) REFERENCES bills(id)
    );
  `);
  for (const m of migrations) {
    try { db.exec(m); } catch (e) { /* column already exists */ }
  }

  // One-time: renumber sequential OCs (OC-001..OC-999) to random 5-digit numbers
  try {
    const seqOrders = db.exec("SELECT id, order_number FROM purchase_orders WHERE length(order_number) <= 6 AND order_number LIKE 'OC-%' ORDER BY id");
    if (seqOrders.length > 0 && seqOrders[0].values.length > 0) {
      let baseNum = Math.floor(Math.random() * 9000) + 1000;
      for (const row of seqOrders[0].values) {
        const newNum = `OC-${String(baseNum).padStart(5, '0')}`;
        db.run(`UPDATE purchase_orders SET order_number = ? WHERE id = ?`, [newNum, row[0]]);
        baseNum += Math.floor(Math.random() * 5) + 1;
      }
      saveDb();
    }
  } catch (_) {}

  // Migrate existing recurring bills from bills table to recurring_bills table
  const recurringCount = dbProxy.prepare('SELECT COUNT(*) as count FROM recurring_bills').get();
  if (recurringCount.count === 0) {
    const recurringBills = dbProxy.prepare(
      "SELECT DISTINCT description, amount, recurring_day, category_id, supplier, value_type, payment_source FROM bills WHERE is_recurring = 1"
    ).all();
    for (const rb of recurringBills) {
      dbProxy.prepare(
        'INSERT INTO recurring_bills (description, amount, due_day, category_id, supplier, value_type, payment_source) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(rb.description, rb.amount, rb.recurring_day || 0, rb.category_id || null, rb.supplier || '', rb.value_type || 'fixed', rb.payment_source || '');
    }
    if (recurringBills.length > 0) console.log(`Migrated ${recurringBills.length} recurring bill templates`);
  }

  const userCount = dbProxy.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    dbProxy.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run('Administrador', 'admin@fincontrol.com', hash, 'admin');
  }

  const catCount = dbProxy.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (catCount.count === 0) {
    const cats = [
      ['Salários', 'expense', '#ef4444', 'users'],
      ['Insumos para Produção', 'expense', '#f97316', 'package'],
      ['Insumos para Venda', 'expense', '#eab308', 'shopping-cart'],
      ['Insumos de Escritório', 'expense', '#22c55e', 'briefcase'],
      ['Impostos', 'expense', '#6366f1', 'landmark'],
      ['Aluguel', 'expense', '#8b5cf6', 'home'],
      ['Energia / Água / Internet', 'expense', '#06b6d4', 'zap'],
      ['Manutenção', 'expense', '#14b8a6', 'wrench'],
      ['Transporte / Frete', 'expense', '#f43f5e', 'truck'],
      ['Marketing', 'expense', '#ec4899', 'megaphone'],
      ['Investimentos', 'expense', '#0ea5e9', 'trending-up'],
      ['Outros', 'expense', '#94a3b8', 'more-horizontal'],
    ];
    for (const c of cats) {
      dbProxy.prepare('INSERT INTO categories (name, type, color, icon) VALUES (?, ?, ?, ?)').run(...c);
    }
  }

  console.log('Database initialized successfully');
}

export default dbProxy;
