const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDb() {
  console.log('[DB] Turso tabloları oluşturuluyor...');

  await db.batch([
    // Users tablosu
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      telegram_chat_id TEXT,
      pairing_code TEXT,
      pairing_code_expires_at TEXT,
      pin TEXT,
      income_expense_password TEXT,
      language TEXT DEFAULT 'tr',
      google_id TEXT,
      display_name TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      is_premium INTEGER DEFAULT 0,
      premium_expires_at TEXT,
      subscription_plan TEXT DEFAULT 'free',
      subscription_type TEXT DEFAULT 'free',
      subscription_status TEXT DEFAULT 'active',
      subscription_expiry TEXT,
      ai_analysis_tokens INTEGER DEFAULT 1,
      ai_tokens_reset_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      role TEXT DEFAULT 'user'
    )`,

    // Payments tablosu
    `CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
      user_id TEXT NOT NULL,
      payment_id TEXT,
      title TEXT,
      amount REAL,
      installments INTEGER,
      date TEXT,
      category TEXT,
      bank TEXT,
      type TEXT,
      installment_plan TEXT DEFAULT '[]',
      currency TEXT DEFAULT 'TRY',
      original_amount REAL,
      created_at TEXT
    )`,

    // Payments index
    `CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id)`,

    // Settings tablosu
    `CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
      user_id TEXT NOT NULL UNIQUE,
      cut_off_day INTEGER DEFAULT 10,
      telegram_bot_token TEXT DEFAULT '',
      telegram_chat_id TEXT,
      telegram_notifications_enabled INTEGER DEFAULT 1,
      banks TEXT DEFAULT '[]',
      notification_days INTEGER DEFAULT 3,
      last_telegram_notification TEXT,
      backup_enabled INTEGER DEFAULT 0,
      backup_time TEXT DEFAULT '00:00'
    )`,

    // Settings index
    `CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(user_id)`,

    // DailyIncomes tablosu
    `CREATE TABLE IF NOT EXISTS daily_incomes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      cash REAL DEFAULT 0,
      cc REAL DEFAULT 0,
      salary REAL DEFAULT 0,
      insurance REAL DEFAULT 0,
      other_income REAL DEFAULT 0,
      expenses TEXT DEFAULT '[]',
      UNIQUE(user_id, date)
    )`,

    // DailyIncomes index
    `CREATE INDEX IF NOT EXISTS idx_daily_incomes_user ON daily_incomes(user_id)`,
  ]);

  console.log('[DB] Turso tabloları hazır ✓');
}

// Sanitize: undefined → null (Turso doesn't accept undefined)
function sanitizeArgs(args) {
  if (!args) return args;
  return args.map(a => (a === undefined ? null : a));
}

function sanitizeStmt(stmt) {
  if (typeof stmt === 'string') return stmt;
  return { ...stmt, args: sanitizeArgs(stmt.args) };
}

const wrappedDb = {
  execute(stmt) {
    return db.execute(sanitizeStmt(stmt));
  },
  batch(stmts) {
    return db.batch(stmts.map(sanitizeStmt));
  },
};

module.exports = { db: wrappedDb, initDb };
