import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function convertSql(sql) {
  let i = 0;
  let result = sql.replace(/\?/g, () => `$${++i}`);
  result = result.replace(/ LIKE /gi, ' ILIKE ');
  return result;
}

const db = {
  prepare(sql) {
    const pgSql = convertSql(sql);
    return {
      async run(...params) {
        if (/^\s*INSERT/i.test(pgSql) && !/RETURNING/i.test(pgSql)) {
          try {
            const result = await pool.query(pgSql + ' RETURNING id', params);
            return { lastInsertRowid: result.rows[0]?.id, changes: result.rowCount };
          } catch (e) {
            if (e.message.includes('column "id"') || e.message.includes('does not exist')) {
              const result = await pool.query(pgSql, params);
              return { lastInsertRowid: null, changes: result.rowCount };
            }
            throw e;
          }
        }
        const result = await pool.query(pgSql, params);
        return { lastInsertRowid: result.rows?.[0]?.id ?? null, changes: result.rowCount };
      },
      async get(...params) {
        const result = await pool.query(pgSql, params);
        return result.rows[0] || undefined;
      },
      async all(...params) {
        const result = await pool.query(pgSql, params);
        return result.rows;
      }
    };
  },
  async exec(sql) {
    await pool.query(sql);
  },
  pool
};

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT DEFAULT 'expense',
      color TEXT DEFAULT '#3b82f6',
      icon TEXT DEFAULT 'tag',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id SERIAL PRIMARY KEY,
      bank_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      description TEXT,
      balance REAL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cost_centers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      budget REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bills (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cost_center_items (
      id SERIAL PRIMARY KEY,
      cost_center_id INTEGER NOT NULL,
      bill_id INTEGER,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT DEFAULT 'material',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT DEFAULT 'un',
      quantity REAL DEFAULT 0,
      unit_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      supplier TEXT,
      nfe_number TEXT,
      min_stock REAL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id SERIAL PRIMARY KEY,
      inventory_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL DEFAULT 0,
      bill_id INTEGER,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS recurring_bills (
      id SERIAL PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      due_day INTEGER NOT NULL,
      category_id INTEGER,
      supplier TEXT,
      value_type TEXT DEFAULT 'fixed',
      auto_generate INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS installment_plans (
      id SERIAL PRIMARY KEY,
      description TEXT NOT NULL,
      creditor TEXT,
      total_amount REAL NOT NULL,
      total_installments INTEGER NOT NULL,
      category_id INTEGER,
      notes TEXT,
      status TEXT DEFAULT 'active',
      created_by INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS incomes (
      id SERIAL PRIMARY KEY,
      description TEXT NOT NULL,
      source TEXT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      category TEXT DEFAULT 'Outros',
      bank_account_id INTEGER,
      notes TEXT,
      status TEXT DEFAULT 'received',
      created_by INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_tabs (
      id SERIAL PRIMARY KEY,
      supplier_name TEXT NOT NULL,
      supplier_id INTEGER,
      month TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      notes TEXT,
      created_by INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS purchase_tab_items (
      id SERIAL PRIMARY KEY,
      tab_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit TEXT DEFAULT 'un',
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0,
      purchase_date TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
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
    INSERT INTO company_settings (id, name) VALUES (1, '') ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit TEXT DEFAULT 'un',
      unit_price REAL DEFAULT 0,
      ipi_percent REAL DEFAULT 0,
      ipi_value REAL DEFAULT 0,
      total REAL DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bill_attachments (
      id SERIAL PRIMARY KEY,
      bill_id INTEGER NOT NULL REFERENCES bills(id),
      filename TEXT NOT NULL,
      content_type TEXT DEFAULT '',
      file_data TEXT NOT NULL,
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id SERIAL PRIMARY KEY,
      supplier_name TEXT NOT NULL,
      supplier_id INTEGER,
      item_description TEXT NOT NULL,
      unit_price REAL NOT NULL,
      date TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      source_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      user_name TEXT DEFAULT '',
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bill_items (
      id SERIAL PRIMARY KEY,
      bill_id INTEGER NOT NULL REFERENCES bills(id),
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit TEXT DEFAULT 'un',
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const migrations = [
    "ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS buyer_name TEXT DEFAULT ''",
    "ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_address TEXT DEFAULT ''",
    "ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS nfe_email TEXT DEFAULT ''",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_source TEXT DEFAULT ''",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS installment_plan_id INTEGER",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS installment_number INTEGER",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS value_type TEXT DEFAULT 'fixed'",
    "ALTER TABLE inventory ADD COLUMN IF NOT EXISTS sale_price REAL DEFAULT 0",
    "ALTER TABLE inventory ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT ''",
    "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS product_category TEXT DEFAULT ''",
    "ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'service'",
    "ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS os_number TEXT DEFAULT ''",
    "ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS nf_remessa TEXT DEFAULT ''",
    "ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS repair_type TEXT DEFAULT ''",
    "ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS promised_deadline TEXT DEFAULT ''",
    "ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS actual_delivery TEXT DEFAULT ''",
    "ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS contracted_value REAL DEFAULT 0",
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS budget REAL DEFAULT 0",
    "ALTER TABLE recurring_bills ADD COLUMN IF NOT EXISTS payment_source TEXT DEFAULT ''",
    "ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount_percent REAL DEFAULT 0",
  ];

  for (const m of migrations) {
    try { await pool.query(m); } catch (e) { /* column already exists */ }
  }

  const userCount = await db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (parseInt(userCount.count) === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run('Administrador', 'admin@fincontrol.com', hash, 'admin');
  }

  const catCount = await db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (parseInt(catCount.count) === 0) {
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
      await db.prepare('INSERT INTO categories (name, type, color, icon) VALUES (?, ?, ?, ?)').run(...c);
    }
  }

  console.log('Database initialized successfully (PostgreSQL)');
}

export default db;
