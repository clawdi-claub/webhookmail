import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

var BASE = 'http://localhost:' + (process.env.TEST_PORT || '3099');

async function json(path, opts) {
  var res = await fetch(BASE + path, opts);
  return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
}

describe('API integration', () => {
  var createdEndpoint;

  it('GET /health returns ok', async () => {
    var { status, body } = await json('/health');
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
  });

  it('POST /api/endpoints creates endpoint with auth token', async () => {
    var { status, body } = await json('/api/endpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@integration.com', name: 'CI Test' }),
    });
    expect(status).toBe(200);
    expect(body.id).toBeDefined();
    expect(body.authToken).toBeDefined();
    expect(body.authToken.length).toBe(64); // 32 bytes hex
    expect(body.webhookUrl).toContain('/hook/');
    expect(body.dashboardUrl).toContain('?token=');
    createdEndpoint = body;
  });

  it('POST /api/endpoints rejects invalid email', async () => {
    var { status } = await json('/api/endpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    expect(status).toBe(400);
  });

  it('POST /hook/:id receives webhook', async () => {
    var { status, body } = await json('/hook/' + createdEndpoint.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'test_webhook', data: 123 }),
    });
    expect(status).toBe(200);
    expect(body.received).toBe(true);
  });

  it('POST /hook/:id returns 404 for unknown endpoint', async () => {
    var { status } = await json('/hook/nonexistent99', { method: 'POST' });
    expect(status).toBe(404);
  });

  it('GET /dashboard/:id without token returns 401', async () => {
    var res = await fetch(BASE + '/dashboard/' + createdEndpoint.id);
    expect(res.status).toBe(401);
  });

  it('GET /dashboard/:id with wrong token returns 401', async () => {
    var res = await fetch(BASE + '/dashboard/' + createdEndpoint.id + '?token=wrongtoken');
    expect(res.status).toBe(401);
  });

  it('GET /dashboard/:id with correct token returns 200', async () => {
    var res = await fetch(BASE + '/dashboard/' + createdEndpoint.id + '?token=' + createdEndpoint.authToken);
    expect(res.status).toBe(200);
  });

  it('GET /api/endpoints/:id without token returns 401', async () => {
    var { status } = await json('/api/endpoints/' + createdEndpoint.id);
    expect(status).toBe(401);
  });

  it('GET /api/endpoints/:id with correct token returns data', async () => {
    var { status, body } = await json('/api/endpoints/' + createdEndpoint.id + '?token=' + createdEndpoint.authToken);
    expect(status).toBe(200);
    expect(body.email).toBe('test@integration.com');
    expect(body.logs).toBeDefined();
    expect(body.monthlyUsage).toBeGreaterThan(0);
    // Should not leak auth_token_hash
    expect(body.auth_token_hash).toBeUndefined();
  });

  it('POST /stripe/webhook rejects without valid signature', async () => {
    var res = await fetch(BASE + '/stripe/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ type: 'checkout.session.completed', id: 'evt_fake', data: { object: {} } }),
    });
    expect(res.status).toBe(400);
  });
});
