# WebhookMail - Code Review by Clawdi

**Reviewer:** Clawdi Claub  
**Date:** 2026-03-06  
**Commit reviewed:** 8c2dbf7 (latest master)

---

## ✅ What's Excellent

### 1. Security Implementation
- **Webhook signature verification** - Proper HMAC-SHA256 with timing-safe comparison ✅
- **Hard-fail on missing secret** - Returns `rejected` when `STRIPE_WEBHOOK_SECRET` not configured ✅
- **Event idempotency** - `processed_events` table with 24h cleanup ✅
- **Security headers** - Full suite implemented ✅
- **Auth token support** - SHA256 hashed tokens for endpoint protection ✅

### 2. Rate Limiting
- Tiered limits: 20/hr endpoints, 120/min hooks, 10/min upgrades ✅
- IPv6 normalization ✅
- 1MB body size limit ✅
- Proper rate limit headers ✅

### 3. Email Delivery
- Resend integration with HTML-formatted emails ✅
- Full payload inspection (headers, body, IP, timestamp) ✅
- Graceful degradation if email fails (catch block) ✅

### 4. Database Design
- Proper foreign keys ✅
- WAL mode for performance ✅
- Indexed queries (`idx_logs_endpoint`, `idx_logs_created`) ✅
- Migration handling for schema changes ✅

### 5. Input Validation
- RFC-compliant email regex ✅
- 254 character email limit (RFC 5321) ✅
- Tier enforcement (50 free vs unlimited pro) ✅

---

## ⚠️ Suggested Improvements

### CRITICAL

#### 1. Webhook secret check should throw, not return
**File:** `src/stripe.js:55-58`
```javascript
if (!STRIPE_WEBHOOK_SECRET) {
  console.error('STRIPE_WEBHOOK_SECRET not configured — rejecting webhook');
  return { action: 'rejected', reason: 'webhook_secret_not_configured' };
}
```
**Issue:** Same as EnvBurn - should throw on startup, not silently reject.

**Fix:**
```javascript
if (!STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET not configured — refusing to process webhooks');
}
```

#### 2. `isConfigured()` incomplete
**File:** `src/stripe.js:86`
```javascript
export function isConfigured() {
  return !!(STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}
```
**Issue:** Missing webhook secret AND Resend API key checks.

**Fix:**
```javascript
export function isConfigured() {
  return !!(
    process.env.STRIPE_SECRET_KEY && 
    process.env.STRIPE_PRICE_ID && 
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.RESEND_API_KEY
  );
}
```

#### 3. Auth token created but never used
**File:** `src/index.js` has `verifyAuthToken()` function
**Issue:** Function defined but not called anywhere in the codebase. Either use it or remove it.

**Check:**
```bash
grep -rn "verifyAuthToken" src/
# Only shows definition, no calls
```

**Suggestion:** Either:
- Add auth token validation to `/hook/:id` endpoint
- Remove the unused code

### MEDIUM

#### 4. No request logging
**File:** `src/index.js`
- Same issue as EnvBurn - no structured logging

**Suggestion:** Add logging middleware (see EnvBurn review)

#### 5. Email delivery failures silent
**File:** `src/index.js:145-155`
```javascript
fetch('https://api.resend.com/emails', {...})
  .catch(e => console.error('Email failed:', e.message));
```
**Issue:** Email failures logged but webhook still returns success. User thinks email was sent, but it wasn't.

**Suggestion:** Track failed deliveries in database:
```javascript
db.prepare('INSERT INTO failed_deliveries (endpoint_id, reason, created_at) VALUES (?, ?, ?)')
  .run(id, e.message, now);
```

Then show in dashboard: "⚠️ 3 emails failed to deliver in last 24h"

#### 6. Test coverage gaps
**Files:** `test/*.test.js`
- Missing: Database migration tests
- Missing: Email delivery tests (mock Resend API)
- Missing: Full webhook → email flow integration test
- Missing: Auth token creation/validation tests
- Missing: Tier limit enforcement tests

**Suggestion:** Add integration tests:
1. Create endpoint
2. Send webhook
3. Verify log created
4. Verify email would be sent (mock)
5. Test free tier limit (50 webhooks)
6. Upgrade to pro
7. Verify limit removed

#### 7. CORS too permissive for `/hook/*`
**File:** `src/index.js:30`
```javascript
app.use('/hook/*', cors());
```
**Issue:** Allows any origin to POST webhooks. While webhooks are meant to be public, this could allow CSRF-style attacks.

**Suggestion:** At minimum, add:
```javascript
app.use('/hook/*', cors({ 
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  maxAge: 86400
}));
```

### LOW

#### 8. Magic number in cleanup interval
**File:** `src/db.js:49`
```javascript
setInterval(function() {
  db.prepare('DELETE FROM processed_events WHERE processed_at < datetime(\'now\', \'-24 hours\')').run();
}, 60000);
```
**Suggestion:** Extract to constant:
```javascript
var CLEANUP_INTERVAL_MS = 60000;
var EVENT_RETENTION_HOURS = 24;
```

#### 9. No pagination for logs
**File:** `src/db.js` - `getLogs()` returns limited results
**Issue:** Dashboard shows last 50 logs, but no pagination for high-volume endpoints

**Suggestion:** Add cursor-based pagination:
```javascript
app.get('/api/endpoints/:id/logs', (c) => {
  const { id } = c.req.param();
  const { cursor, limit = 50 } = c.req.query();
  const logs = db.getLogs(id, parseInt(limit) + 1, cursor);
  const nextCursor = logs.length > limit ? logs[limit - 1].id : null;
  return c.json({ logs: logs.slice(0, limit), nextCursor });
});
```

#### 10. Health check too simple
**File:** `src/index.js:72`
```javascript
app.get('/health', (c) => c.json({ status: 'ok', service: 'webhookmail' }));
```
**Issue:** Doesn't verify database or Resend connectivity

**Suggestion:** Enhanced health check:
```javascript
app.get('/health', async (c) => {
  const checks = {};
  try {
    db.prepare('SELECT 1').get();
    checks.database = 'ok';
  } catch (e) {
    checks.database = 'error: ' + e.message;
  }
  
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY }
      });
      checks.resend = res.ok ? 'ok' : 'error: ' + res.status;
    } catch (e) {
      checks.resend = 'error: ' + e.message;
    }
  } else {
    checks.resend = 'not configured';
  }
  
  const allOk = Object.values(checks).every(v => v === 'ok');
  return c.json({ 
    status: allOk ? 'ok' : 'degraded', 
    service: 'webhookmail',
    checks 
  }, allOk ? 200 : 503);
});
```

---

## 📊 Confidence Level

**Current confidence: 82%** that WebhookMail is production-ready.

### Breakdown:
- **Security:** 88% (good webhook verification, but soft-fail issue)
- **Code quality:** 85% (clean, but unused code present)
- **Testing:** 70% (basic tests, needs integration coverage)
- **Deployment:** 80% (CI/CD ready, health checks incomplete)
- **Email delivery:** 75% (works, but no failure tracking)

### Blocking production:
1. Fix webhook secret check to throw on startup
2. Fix `isConfigured()` to check all required vars
3. Decide on auth token usage (implement or remove)
4. Add integration tests for webhook → email flow
5. Add failed delivery tracking

### After fixes: **93% confidence**

---

## 🎯 Summary

WebhookMail is solid but has more rough edges than EnvBurn. The core functionality works well - webhooks are received, logged, and emails are sent. The database design is good, and rate limiting is properly implemented.

**Main issues:**
1. **Same soft-fail problem** as EnvBurn - needs to throw on missing config
2. **Unused auth token code** - technical debt
3. **No failure tracking** - email delivery failures go unnoticed
4. **Less comprehensive testing** than EnvBurn

**Nice touches:**
- Auth token support (even if unused yet)
- Proper email HTML formatting
- Good migration handling
- IPv6 normalization in rate limiter

**Comparison to EnvBurn:** WebhookMail feels slightly less polished. The unused auth token code suggests features were started but not finished. Email delivery failure tracking is a notable gap - in production, you'll want to know when emails aren't being delivered.

Overall: **Good foundation, needs finishing touches and harder failure modes.** 🐾
