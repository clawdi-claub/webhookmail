import { describe, it, expect } from 'vitest';
import db from '../src/db.js';

describe('Endpoint CRUD', () => {
  var id = 'dbtest_' + Date.now();

  it('creates endpoint', () => {
    var r = db.createEndpoint(id, 'test@x.com', 'Test', new Date().toISOString());
    expect(r.changes).toBe(1);
  });

  it('gets endpoint by id', () => {
    var ep = db.getEndpoint(id);
    expect(ep.email).toBe('test@x.com');
    expect(ep.tier).toBe('free');
  });

  it('sets auth token hash', () => {
    db.setAuthTokenHash(id, 'abc123hash');
    var ep = db.getEndpoint(id);
    expect(ep.auth_token_hash).toBe('abc123hash');
  });

  it('logs webhook and increments count', () => {
    db.logWebhook(id, 'POST', '{}', '{"test":1}', '1.2.3.4', new Date().toISOString());
    var ep = db.getEndpoint(id);
    expect(ep.webhook_count).toBe(1);
  });

  it('gets logs', () => {
    var logs = db.getLogs(id, 10);
    expect(logs.length).toBe(1);
    expect(logs[0].method).toBe('POST');
  });

  it('gets monthly count', () => {
    expect(db.getMonthlyCount(id)).toBeGreaterThan(0);
  });

  it('upgrades tier', () => {
    db.upgradeTier(id, 'pro', 'cus_1', 'sub_1');
    expect(db.getEndpoint(id).tier).toBe('pro');
  });

  it('downgrades by subscription', () => {
    db.downgradeBySubscription('sub_1');
    expect(db.getEndpoint(id).tier).toBe('free');
  });
});

describe('Event idempotency', () => {
  var evtId = 'evt_dbtest_' + Date.now();

  it('returns false for new event', () => {
    expect(db.isEventProcessed(evtId)).toBe(false);
  });

  it('marks and detects processed event', () => {
    db.markEventProcessed(evtId);
    expect(db.isEventProcessed(evtId)).toBe(true);
  });

  it('handles duplicate mark gracefully', () => {
    expect(() => db.markEventProcessed(evtId)).not.toThrow();
  });
});
