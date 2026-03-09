import initSqlJs from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DB_PATH || './data/webhookmail.db';
const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const SQL = await initSqlJs();
let db;
if (existsSync(DB_PATH)) {
  const buf = readFileSync(DB_PATH);
  db = new SQL.Database(buf);
} else {
  db = new SQL.Database();
}

db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA foreign_keys = ON');

db.run(`
  CREATE TABLE IF NOT EXISTS endpoints (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    tier TEXT DEFAULT 'free',
    auth_token_hash TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    webhook_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS processed_events (
    event_id TEXT PRIMARY KEY,
    processed_at TEXT NOT NULL
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint_id TEXT NOT NULL,
    method TEXT,
    headers TEXT,
    body TEXT,
    source_ip TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (endpoint_id) REFERENCES endpoints(id)
  )
`);
db.run('CREATE INDEX IF NOT EXISTS idx_logs_endpoint ON logs(endpoint_id)');
db.run('CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at)');

// Migration: add auth_token_hash if missing
try { db.run('ALTER TABLE endpoints ADD COLUMN auth_token_hash TEXT'); } catch (e) { /* already exists */ }

// Persist to disk periodically and on changes
function save() {
  const data = db.export();
  writeFileSync(DB_PATH, Buffer.from(data));
}

// Save every 5s if there are changes
let dirty = false;
function markDirty() { dirty = true; }
setInterval(function() {
  if (dirty) { save(); dirty = false; }
}, 5000);

// Save on exit
process.on('exit', save);
process.on('SIGINT', function() { save(); process.exit(0); });
process.on('SIGTERM', function() { save(); process.exit(0); });

// Helper: get one row
function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

// Helper: get all rows
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// Helper: run statement
function run(sql, params = []) {
  db.run(sql, params);
  markDirty();
}

// Cleanup old processed events every 60s (keep 24h)
setInterval(function() {
  var cutoff = new Date(Date.now() - 86400000).toISOString();
  run('DELETE FROM processed_events WHERE processed_at < ?', [cutoff]);
}, 60000);

export default {
  createEndpoint(id, email, name, createdAt) {
    run('INSERT INTO endpoints (id, email, name, created_at) VALUES (?, ?, ?, ?)', [id, email, name, createdAt]);
  },
  getEndpoint(id) {
    return get('SELECT * FROM endpoints WHERE id = ?', [id]);
  },
  getEndpointByEmail(email) {
    return get('SELECT * FROM endpoints WHERE email = ?', [email]);
  },
  incrementCount(id) {
    run('UPDATE endpoints SET webhook_count = webhook_count + 1 WHERE id = ?', [id]);
  },
  logWebhook(endpointId, method, headers, body, sourceIp, createdAt) {
    run('INSERT INTO logs (endpoint_id, method, headers, body, source_ip, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [endpointId, method, headers, body, sourceIp, createdAt]);
    run('UPDATE endpoints SET webhook_count = webhook_count + 1 WHERE id = ?', [endpointId]);
  },
  getLogs(endpointId, limit = 20) {
    return all('SELECT * FROM logs WHERE endpoint_id = ? ORDER BY created_at DESC LIMIT ?', [endpointId, limit]);
  },
  upgradeTier(id, tier, customerId, subscriptionId) {
    run('UPDATE endpoints SET tier = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?',
      [tier, customerId, subscriptionId, id]);
  },
  downgradeBySubscription(subscriptionId) {
    run('UPDATE endpoints SET tier = ? WHERE stripe_subscription_id = ?', ['free', subscriptionId]);
  },
  getMonthlyCount(endpointId) {
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);
    const row = get('SELECT COUNT(*) as count FROM logs WHERE endpoint_id = ? AND created_at > ?',
      [endpointId, firstOfMonth.toISOString()]);
    return row ? row.count : 0;
  },
  setAuthTokenHash(id, hash) {
    run('UPDATE endpoints SET auth_token_hash = ? WHERE id = ?', [hash, id]);
  },
  isEventProcessed(eventId) {
    return !!get('SELECT 1 FROM processed_events WHERE event_id = ?', [eventId]);
  },
  markEventProcessed(eventId) {
    run('INSERT OR IGNORE INTO processed_events (event_id, processed_at) VALUES (?, ?)',
      [eventId, new Date().toISOString()]);
  },
};
