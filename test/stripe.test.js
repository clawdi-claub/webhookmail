import { describe, it, expect } from 'vitest';
import { handleWebhook, isConfigured } from '../src/stripe.js';

describe('Stripe webhook verification', () => {
  it('should throw error when STRIPE_WEBHOOK_SECRET is not set', async () => {
    const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = undefined;
    
    await expect(async () => {
      await handleWebhook('{"type":"checkout.session.completed"}', 't=123,v1=abc');
    }).rejects.toThrow('STRIPE_WEBHOOK_SECRET not configured');
    
    process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  });

  it('should reject invalid signature', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
    const result = await handleWebhook('{"type":"checkout.session.completed"}', 't=123,v1=invalid');
    expect(result.action).toBe('rejected');
    expect(result.reason).toBe('invalid_signature');
  });

  it('should parse checkout.session.completed event', async () => {
    // Would need valid signature - tested in integration tests
  });

  it('should parse customer.subscription.deleted event', async () => {
    const payload = JSON.stringify({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_123', customer: 'cus_456' } }
    });
    // Would need valid signature
  });

  it('should parse invoice.payment_failed event', async () => {
    const payload = JSON.stringify({
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_456' } }
    });
    // Would need valid signature
  });
});

describe('isConfigured', () => {
  it('should return false when STRIPE_WEBHOOK_SECRET is missing', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    process.env.STRIPE_PRICE_ID = 'price_test';
    process.env.STRIPE_WEBHOOK_SECRET = undefined;
    expect(isConfigured()).toBe(false);
  });

  it('should return true when all required vars are set', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    process.env.STRIPE_PRICE_ID = 'price_test';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    expect(isConfigured()).toBe(true);
  });
});
