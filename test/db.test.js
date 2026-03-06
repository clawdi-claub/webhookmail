import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = join(__dirname, 'test.db');

describe('Database operations', () => {
  let db;

  beforeAll(async () => {
    process.env.DB_PATH = TEST_DB_PATH;
    const dbModule = await import('../src/db.js');
    db = dbModule.default;
  });

  afterAll(() => {
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH);
    }
    if (existsSync(TEST_DB_PATH + '-wal')) {
      rmSync(TEST_DB_PATH + '-wal');
    }
    if (existsSync(TEST_DB_PATH + '-shm')) {
      rmSync(TEST_DB_PATH + '-shm');
    }
  });

  it('should create endpoint', () => {
    const id = 'test_endpoint_1';
    const email = 'test@example.com';
    const now = new Date().toISOString();
    
    const result = db.createEndpoint(id, email, 'Test Endpoint', now);
    expect(result.changes).toBe(1);
  });

  it('should get endpoint by id', () => {
    const endpoint = db.getEndpoint('test_endpoint_1');
    expect(endpoint).toBeDefined();
    expect(endpoint.email).toBe('test@example.com');
  });

  it('should log webhook', () => {
    const endpointId = 'test_endpoint_1';
    const method = 'POST';
    const headers = JSON.stringify({ 'Content-Type': 'application/json' });
    const body = '{"event":"test"}';
    const sourceIp = '127.0.0.1';
    const now = new Date().toISOString();
    
    db.logWebhook(endpointId, method, headers, body, sourceIp, now);
    expect(endpointId).toBeDefined();
  });

  it('should get logs for endpoint', () => {
    const logs = db.getLogs('test_endpoint_1', 10);
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThan(0);
  });

  it('should get monthly count', () => {
    const count = db.getMonthlyCount('test_endpoint_1');
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThan(0);
  });

  it('should upgrade tier', () => {
    db.upgradeTier('test_endpoint_1', 'pro', 'cus_test', 'sub_test');
    const endpoint = db.getEndpoint('test_endpoint_1');
    expect(endpoint.tier).toBe('pro');
    expect(endpoint.stripe_customer_id).toBe('cus_test');
  });

  it('should downgrade by subscription', () => {
    db.downgradeBySubscription('sub_test');
    const endpoint = db.getEndpoint('test_endpoint_1');
    expect(endpoint.tier).toBe('free');
  });
});
