const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

function createDb(file = ':memory:') {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee','admin')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS time_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      clock_in TEXT NOT NULL,
      clock_out TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_logs_user_date ON time_logs(user_id, date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_log ON time_logs(user_id) WHERE clock_out IS NULL;
  `);
  return db;
}

function seedAdmin(db, email, password, name = 'Administrator') {
  if (db.prepare("SELECT 1 FROM users WHERE role='admin'").get()) return false;
  db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')
    .run(name, email.toLowerCase(), bcrypt.hashSync(password, 10), 'admin');
  return true;
}

module.exports = { createDb, seedAdmin };
