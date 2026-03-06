import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const DB_PATH = process.env.DB_PATH || './data/webhookmail.db';
const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
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
  );

  CREATE TABLE IF NOT EXISTS processed_events (
    event_id TEXT PRIMARY KEY,
    processed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint_id TEXT NOT NULL,
    method TEXT,
    headers TEXT,
    body TEXT,
    source_ip TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (endpoint_id) REFERENCES endpoints(id)
  );

  CREATE INDEX IF NOT EXISTS idx_logs_endpoint ON logs(endpoint_id);
  CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);
`);

// Migration: add auth_token_hash if missing
try { db.exec('ALTER TABLE endpoints ADD COLUMN auth_token_hash TEXT'); } catch (e) { /* already exists */ }

// Cleanup old processed events every 60s (keep 24h)
setInterval(function() {
  var cutoff = new Date(Date.now() - 86400000).toISOString();
  db.prepare('DELETE FROM processed_events WHERE processed_at < ?').run(cutoff);
}, 60000);

const stmts = {
  createEndpoint: db.prepare('INSERT INTO endpoints (id, email, name, created_at) VALUES (?, ?, ?, ?)'),
  getEndpoint: db.prepare('SELECT * FROM endpoints WHERE id = ?'),
  getEndpointByEmail: db.prepare('SELECT * FROM endpoints WHERE email = ?'),
  incrementCount: db.prepare('UPDATE endpoints SET webhook_count = webhook_count + 1 WHERE id = ?'),
  getCount: db.prepare('SELECT webhook_count FROM endpoints WHERE id = ?'),
  insertLog: db.prepare('INSERT INTO logs (endpoint_id, method, headers, body, source_ip, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  getLogs: db.prepare('SELECT * FROM logs WHERE endpoint_id = ? ORDER BY created_at DESC LIMIT ?'),
  getLogCount: db.prepare('SELECT COUNT(*) as count FROM logs WHERE endpoint_id = ? AND created_at > ?'),
};

export default {
  createEndpoint(id, email, name, createdAt) {
    return stmts.createEndpoint.run(id, email, name, createdAt);
  },
  getEndpoint(id) {
    return stmts.getEndpoint.get(id);
  },
  getEndpointByEmail(email) {
    return stmts.getEndpointByEmail.get(email);
  },
  incrementCount(id) {
    return stmts.incrementCount.run(id);
  },
  logWebhook(endpointId, method, headers, body, sourceIp, createdAt) {
    stmts.insertLog.run(endpointId, method, headers, body, sourceIp, createdAt);
    stmts.incrementCount.run(endpointId);
  },
  getLogs(endpointId, limit = 20) {
    return stmts.getLogs.all(endpointId, limit);
  },
  upgradeTier(id, tier, customerId, subscriptionId) {
    db.prepare('UPDATE endpoints SET tier = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?')
      .run(tier, customerId, subscriptionId, id);
  },
  downgradeBySubscription(subscriptionId) {
    db.prepare('UPDATE endpoints SET tier = ? WHERE stripe_subscription_id = ?')
      .run('free', subscriptionId);
  },
  getMonthlyCount(endpointId) {
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);
    return stmts.getLogCount.get(endpointId, firstOfMonth.toISOString())?.count || 0;
  },
  setAuthTokenHash(id, hash) {
    db.prepare('UPDATE endpoints SET auth_token_hash = ? WHERE id = ?').run(hash, id);
  },
  isEventProcessed(eventId) {
    return !!db.prepare('SELECT 1 FROM processed_events WHERE event_id = ?').get(eventId);
  },
  markEventProcessed(eventId) {
    db.prepare('INSERT OR IGNORE INTO processed_events (event_id, processed_at) VALUES (?, ?)').run(eventId, new Date().toISOString());
  },
};
