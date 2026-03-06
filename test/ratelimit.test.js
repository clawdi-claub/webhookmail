import { describe, it, expect } from 'vitest';
import { rateLimit } from '../src/ratelimit.js';

function mockCtx(ip) {
  var headers = {};
  return {
    req: { header: (n) => n === 'x-forwarded-for' ? ip : null },
    header: (k, v) => { headers[k] = v; },
    json: (data, status) => ({ data, status }),
    _headers: headers,
  };
}

describe('Rate limiting', () => {
  it('allows under limit', async () => {
    var limiter = rateLimit({ prefix: 'wm-t1', window: 60000, max: 5 });
    var called = false;
    await limiter(mockCtx('10.1.0.1'), () => { called = true; });
    expect(called).toBe(true);
  });

  it('blocks over limit', async () => {
    var limiter = rateLimit({ prefix: 'wm-t2', window: 60000, max: 2 });
    var ctx = mockCtx('10.1.0.2');
    await limiter(ctx, () => {});
    await limiter(ctx, () => {});
    var r = await limiter(ctx, () => {});
    expect(r.status).toBe(429);
  });

  it('separates IPs', async () => {
    var limiter = rateLimit({ prefix: 'wm-t3', window: 60000, max: 1 });
    await limiter(mockCtx('10.1.0.3'), () => {});
    var blocked = await limiter(mockCtx('10.1.0.3'), () => {});
    expect(blocked.status).toBe(429);
    var ok = false;
    await limiter(mockCtx('10.1.0.4'), () => { ok = true; });
    expect(ok).toBe(true);
  });

  it('normalizes IPv6-mapped IPv4', async () => {
    var limiter = rateLimit({ prefix: 'wm-t4', window: 60000, max: 1 });
    await limiter(mockCtx('::ffff:10.1.0.5'), () => {});
    var blocked = await limiter(mockCtx('10.1.0.5'), () => {});
    expect(blocked.status).toBe(429);
  });
});
