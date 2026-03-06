import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { handleWebhook, isConfigured } from '../src/stripe.js';

function makeSignature(payload, secret) {
  var t = Math.floor(Date.now() / 1000);
  var sig = createHmac('sha256', secret).update(t + '.' + payload).digest('hex');
  return 't=' + t + ',v1=' + sig;
}

describe('handleWebhook', () => {
  it('throws error when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    var orig = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    var body = '{"type":"checkout.session.completed"}';
    await expect(handleWebhook(body, 't=123,v1=fake')).rejects.toThrow('STRIPE_WEBHOOK_SECRET not configured');
    if (orig) process.env.STRIPE_WEBHOOK_SECRET = orig;
  });

  it('rejects invalid signature', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    var body = JSON.stringify({ type: 'checkout.session.completed', id: 'evt_1', data: { object: {} } });
    var result = await handleWebhook(body, 't=123,v1=invalid');
    expect(result.action).toBe('rejected');
  });

  it('rejects expired timestamp', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    var body = JSON.stringify({ type: 'test', id: 'evt_2' });
    var oldTs = Math.floor(Date.now() / 1000) - 600;
    var result = await handleWebhook(body, 't=' + oldTs + ',v1=doesntmatter');
    expect(result.action).toBe('rejected');
  });

  it('returns eventId in response', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    var result = await handleWebhook('{"id":"evt_test"}', 't=1,v1=x');
    expect(result).toHaveProperty('action');
  });

  it('upgrades on checkout.session.completed', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    var body = JSON.stringify({
      type: 'checkout.session.completed',
      id: 'evt_test',
      data: {
        object: {
          metadata: { endpoint_id: 'ep_test' },
          customer: 'cus_test',
          subscription: 'sub_test'
        }
      }
    });
    var sig = makeSignature(body, 'whsec_test');
    var result = await handleWebhook(body, sig);
    expect(result.action).toBe('upgrade');
    expect(result.endpointId).toBe('ep_test');
  });

  it('returns payment_failed action on invoice.payment_failed', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    var body = JSON.stringify({
      type: 'invoice.payment_failed',
      id: 'evt_fail',
      data: { object: { customer: 'cus_test' } }
    });
    var sig = makeSignature(body, 'whsec_test');
    var result = await handleWebhook(body, sig);
    expect(result.action).toBe('payment_failed');
    expect(result.customerId).toBe('cus_test');
    expect(result.eventId).toBe('evt_fail');
  });
});

describe('isConfigured', () => {
  it('returns false when STRIPE_SECRET_KEY is missing', () => {
    var origKey = process.env.STRIPE_SECRET_KEY;
    var origPrice = process.env.STRIPE_PRICE_ID;
    var origWebhook = process.env.STRIPE_WEBHOOK_SECRET;
    var origResend = process.env.RESEND_API_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_PRICE_ID = 'price_test';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.RESEND_API_KEY = 're_test';
    expect(isConfigured()).toBe(false);
    if (origKey) process.env.STRIPE_SECRET_KEY = origKey;
    if (origPrice) process.env.STRIPE_PRICE_ID = origPrice;
    if (origWebhook) process.env.STRIPE_WEBHOOK_SECRET = origWebhook;
    if (origResend) process.env.RESEND_API_KEY = origResend;
  });

  it('returns false when STRIPE_PRICE_ID is missing', () => {
    var origKey = process.env.STRIPE_SECRET_KEY;
    var origPrice = process.env.STRIPE_PRICE_ID;
    var origWebhook = process.env.STRIPE_WEBHOOK_SECRET;
    var origResend = process.env.RESEND_API_KEY;
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    delete process.env.STRIPE_PRICE_ID;
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.RESEND_API_KEY = 're_test';
    expect(isConfigured()).toBe(false);
    if (origKey) process.env.STRIPE_SECRET_KEY = origKey;
    if (origPrice) process.env.STRIPE_PRICE_ID = origPrice;
    if (origWebhook) process.env.STRIPE_WEBHOOK_SECRET = origWebhook;
    if (origResend) process.env.RESEND_API_KEY = origResend;
  });

  it('returns false when STRIPE_WEBHOOK_SECRET is missing', () => {
    var origKey = process.env.STRIPE_SECRET_KEY;
    var origPrice = process.env.STRIPE_PRICE_ID;
    var origWebhook = process.env.STRIPE_WEBHOOK_SECRET;
    var origResend = process.env.RESEND_API_KEY;
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    process.env.STRIPE_PRICE_ID = 'price_test';
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.RESEND_API_KEY = 're_test';
    expect(isConfigured()).toBe(false);
    if (origKey) process.env.STRIPE_SECRET_KEY = origKey;
    if (origPrice) process.env.STRIPE_PRICE_ID = origPrice;
    if (origWebhook) process.env.STRIPE_WEBHOOK_SECRET = origWebhook;
    if (origResend) process.env.RESEND_API_KEY = origResend;
  });

  it('returns false when RESEND_API_KEY is missing', () => {
    var origKey = process.env.STRIPE_SECRET_KEY;
    var origPrice = process.env.STRIPE_PRICE_ID;
    var origWebhook = process.env.STRIPE_WEBHOOK_SECRET;
    var origResend = process.env.RESEND_API_KEY;
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    process.env.STRIPE_PRICE_ID = 'price_test';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    delete process.env.RESEND_API_KEY;
    expect(isConfigured()).toBe(false);
    if (origKey) process.env.STRIPE_SECRET_KEY = origKey;
    if (origPrice) process.env.STRIPE_PRICE_ID = origPrice;
    if (origWebhook) process.env.STRIPE_WEBHOOK_SECRET = origWebhook;
    if (origResend) process.env.RESEND_API_KEY = origResend;
  });

  it('returns true when all required vars are set', () => {
    var origKey = process.env.STRIPE_SECRET_KEY;
    var origPrice = process.env.STRIPE_PRICE_ID;
    var origWebhook = process.env.STRIPE_WEBHOOK_SECRET;
    var origResend = process.env.RESEND_API_KEY;
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    process.env.STRIPE_PRICE_ID = 'price_test';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.RESEND_API_KEY = 're_test';
    expect(isConfigured()).toBe(true);
    if (origKey) process.env.STRIPE_SECRET_KEY = origKey;
    if (origPrice) process.env.STRIPE_PRICE_ID = origPrice;
    if (origWebhook) process.env.STRIPE_WEBHOOK_SECRET = origWebhook;
    if (origResend) process.env.RESEND_API_KEY = origResend;
  });
});
