import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { nanoid } from 'nanoid';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import db from './db.js';
import { landingPage, dashboardPage } from './pages.js';
import { createCheckoutSession, handleWebhook, isConfigured } from './stripe.js';
import { rateLimit } from './ratelimit.js';

const app = new Hono();

// Request logging middleware
app.use('*', async function(c, next) {
  var start = Date.now();
  await next();
  if (process.env.NODE_ENV !== 'test') {
    console.log('[%s] %s %s %sms %s',
      new Date().toISOString(),
      c.req.method,
      c.req.path,
      Date.now() - start,
      c.res.status
    );
  }
});

// Security headers
app.use('*', async function(c, next) {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

// CORS: restrict to same origin in production, open for hook receivers
app.use('/api/*', cors({
  origin: function(origin) {
    if (!origin) return true; // Allow non-browser requests
    if (origin === BASE_URL) return true;
    if (process.env.NODE_ENV !== 'production') return true;
    return false; // Explicitly deny other origins in production
  },
  allowMethods: ['GET', 'POST'],
}));
// Hook receivers MUST accept CORS from any origin (third-party webhooks from Stripe, GitHub, etc.)
app.use('/hook/*', cors());

// Rate limits
// Body size limit (1MB)
app.use('*', async function(c, next) {
  var cl = c.req.header('content-length');
  if (cl && parseInt(cl) > 1048576) {
    return c.json({ error: 'Request too large' }, 413);
  }
  await next();
});

app.use('/api/endpoints', rateLimit({ prefix: 'create', window: 3600000, max: 20, message: 'Too many endpoints created. Try again later.' }));
app.use('/hook/*', rateLimit({ prefix: 'hook', window: 60000, max: 120, message: 'Rate limit exceeded.' }));
app.use('/api/upgrade/*', rateLimit({ prefix: 'upgrade', window: 60000, max: 10, message: 'Too many requests.' }));

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FREE_LIMIT = 50;
const BASE_URL = process.env.BASE_URL || 'https://webhookmail.onrender.com';

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function verifyAuthToken(endpoint, token) {
  if (!endpoint.auth_token_hash || !token) return false;
  var provided = createHash('sha256').update(token).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(endpoint.auth_token_hash));
  } catch (e) { return false; }
}

// Static files
app.get('/favicon.svg', async (c) => {
  const { readFileSync } = await import('fs');
  return c.body(readFileSync('./static/favicon.svg'), { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } });
});
app.get('/manifest.json', async (c) => {
  const { readFileSync } = await import('fs');
  return c.body(readFileSync('./static/manifest.json'), { headers: { 'Content-Type': 'application/json' } });
});
app.get('/robots.txt', async (c) => {
  const { readFileSync } = await import('fs');
  return c.body(readFileSync('./static/robots.txt'), { headers: { 'Content-Type': 'text/plain' } });
});
app.get('/sitemap.xml', (c) => {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '<url><loc>' + BASE_URL + '/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>',
    '</urlset>',
  ].join('\n');
  return c.body(xml, { headers: { 'Content-Type': 'application/xml' } });
});

app.get('/health', (c) => {
  var dbOk = true;
  try { db.getEndpoint('healthcheck_dummy_id'); } catch (e) { dbOk = false; }
  var stripeOk = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID && process.env.STRIPE_WEBHOOK_SECRET);
  var resendOk = !!process.env.RESEND_API_KEY;
  var allOk = dbOk && stripeOk && resendOk;
  return c.json({
    status: allOk ? 'ok' : 'degraded',
    service: 'webhookmail',
    db: dbOk ? 'ok' : 'error',
    stripe: stripeOk ? 'configured' : 'unconfigured',
    resend: resendOk ? 'configured' : 'unconfigured',
  }, allOk ? 200 : 503);
});

app.get('/', (c) => c.html(landingPage()));

// Create endpoint
app.post('/api/endpoints', async (c) => {
  const { email, name } = await c.req.json();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return c.json({ error: 'Valid email required' }, 400);
  }
  const id = nanoid(12);
  const now = new Date().toISOString();
  const authToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(authToken).digest('hex');
  db.createEndpoint(id, email, name || 'My Webhook', now);
  db.setAuthTokenHash(id, tokenHash);
  return c.json({
    id, email,
    name: name || 'My Webhook',
    authToken: authToken,
    webhookUrl: BASE_URL + '/hook/' + id,
    dashboardUrl: BASE_URL + '/dashboard/' + id + '?token=' + authToken,
  });
});

// Receive webhook
const hookHandler = async (c) => {
  const { id } = c.req.param();
  const endpoint = db.getEndpoint(id);
  if (!endpoint) return c.json({ error: 'Endpoint not found' }, 404);

  if (endpoint.tier === 'free') {
    const monthly = db.getMonthlyCount(id);
    if (monthly >= FREE_LIMIT) {
      return c.json({ error: 'Monthly limit reached (50/month). Upgrade to Pro for unlimited.' }, 429);
    }
  }

  const method = c.req.method;
  const headers = Object.fromEntries(c.req.raw.headers);
  let body = '';
  try { body = await c.req.text(); } catch {}
  const sourceIp = headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown';
  const now = new Date().toISOString();

  db.logWebhook(id, method, JSON.stringify(headers), body, sourceIp, now);

  if (RESEND_API_KEY) {
    let prettyBody = body;
    try { prettyBody = JSON.stringify(JSON.parse(body), null, 2); } catch {}

    const emailHtml = [
      '<div style="font-family:monospace;max-width:600px;margin:0 auto">',
      '<h2 style="color:#6366f1">Webhook Received</h2>',
      '<table style="width:100%;border-collapse:collapse">',
      '<tr><td style="padding:4px 8px;color:#666">Endpoint</td><td>' + id + '</td></tr>',
      '<tr><td style="padding:4px 8px;color:#666">Method</td><td><strong>' + method + '</strong></td></tr>',
      '<tr><td style="padding:4px 8px;color:#666">Time</td><td>' + now + '</td></tr>',
      '<tr><td style="padding:4px 8px;color:#666">Source</td><td>' + esc(sourceIp) + '</td></tr>',
      '</table>',
      '<h3 style="margin-top:16px">Body</h3>',
      '<pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow-x:auto;font-size:13px">' + esc(prettyBody || '(empty)') + '</pre>',
      '<hr style="margin-top:24px;border:none;border-top:1px solid #eee">',
      '<p style="color:#999;font-size:12px">WebhookMail - <a href="' + BASE_URL + '/dashboard/' + id + '">View Dashboard</a></p>',
      '</div>',
    ].join('');

    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'WebhookMail <notifications@webhookmail.app>',
        to: endpoint.email,
        subject: 'Webhook: ' + method + ' -> ' + id.slice(0, 6),
        html: emailHtml
      })
    }).catch(e => console.error('Email failed:', e.message));
  }

  return c.json({ received: true, id, timestamp: now });
};

app.all('/hook/:id', hookHandler);

// Dashboard (requires auth token)
app.get('/dashboard/:id', (c) => {
  const { id } = c.req.param();
  const endpoint = db.getEndpoint(id);
  if (!endpoint) return c.html('<h1>Not found</h1>', 404);
  const token = c.req.query('token');
  if (!verifyAuthToken(endpoint, token)) {
    return c.html('<h1>Unauthorized</h1><p>Invalid or missing auth token.</p>', 401);
  }
  const logs = db.getLogs(id, 50);
  const monthly = db.getMonthlyCount(id);
  return c.html(dashboardPage(endpoint, logs, monthly));
});

// API: endpoint info (requires auth token)
app.get('/api/endpoints/:id', (c) => {
  const { id } = c.req.param();
  const endpoint = db.getEndpoint(id);
  if (!endpoint) return c.json({ error: 'Not found' }, 404);
  const token = c.req.query('token');
  if (!verifyAuthToken(endpoint, token)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const logs = db.getLogs(id, 20);
  const monthly = db.getMonthlyCount(id);
  var safe = { id: endpoint.id, email: endpoint.email, name: endpoint.name, tier: endpoint.tier, webhook_count: endpoint.webhook_count, created_at: endpoint.created_at };
  return c.json({ ...safe, logs, monthlyUsage: monthly, webhookUrl: BASE_URL + '/hook/' + id });
});

// Stripe: create checkout session
app.post('/api/upgrade/:id', async (c) => {
  const { id } = c.req.param();
  const endpoint = db.getEndpoint(id);
  if (!endpoint) return c.json({ error: 'Not found' }, 404);
  if (!isConfigured()) return c.json({ error: 'Payments not configured yet' }, 503);

  const session = await createCheckoutSession(id, endpoint.email, process.env.STRIPE_PRICE_ID);
  if (session.error) return c.json({ error: session.error.message }, 400);
  return c.json({ url: session.url });
});

// Stripe: redirect to checkout
app.get('/upgrade/:id', async (c) => {
  const { id } = c.req.param();
  const endpoint = db.getEndpoint(id);
  if (!endpoint) return c.html('<h1>Not found</h1>', 404);
  if (!isConfigured()) return c.html('<h1>Payments coming soon</h1>');

  const session = await createCheckoutSession(id, endpoint.email, process.env.STRIPE_PRICE_ID);
  if (session.url) return c.redirect(session.url);
  return c.html('<h1>Error creating checkout</h1>', 500);
});

// Stripe: success page
app.get('/upgrade/success', (c) => {
  const endpointId = c.req.query('endpoint');
  return c.html([
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Upgrade Successful</title>',
    '<style>body{font-family:system-ui;background:#0f0f11;color:#e4e4e7;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}',
    '.card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:40px;text-align:center;max-width:400px}',
    '.card h1{color:#22c55e;margin-bottom:12px}a{color:#818cf8}</style></head><body>',
    '<div class="card"><h1>&#10003; Upgraded to Pro!</h1>',
    '<p>Unlimited webhooks, 30-day history, priority delivery.</p>',
    endpointId ? '<p style="margin-top:16px"><a href="/dashboard/' + endpointId + '">Go to Dashboard &rarr;</a></p>' : '',
    '</div></body></html>',
  ].join(''));
});

// Stripe webhook handler
app.post('/stripe/webhook', async (c) => {
  try {
    const rawBody = await c.req.text();
    const sig = c.req.header('stripe-signature');
    const result = await handleWebhook(rawBody, sig);

    if (result.action === 'rejected') {
      return c.json({ error: result.reason }, 400);
    }

    // Idempotency: skip already-processed events
    if (result.eventId && db.isEventProcessed(result.eventId)) {
      return c.json({ received: true, duplicate: true });
    }

    if (result.action === 'upgrade' && result.endpointId) {
      db.upgradeTier(result.endpointId, 'pro', result.customerId, result.subscriptionId);
    } else if (result.action === 'downgrade') {
      db.downgradeBySubscription(result.subscriptionId);
    }

    if (result.eventId) db.markEventProcessed(result.eventId);
    return c.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err.message);
    return c.json({ error: 'webhook_config_error', message: err.message }, 503);
  }
});

// CRITICAL: Fail fast in production if Stripe webhook secret is missing
if (process.env.NODE_ENV === 'production' && !process.env.STRIPE_WEBHOOK_SECRET) {
  console.error('FATAL: STRIPE_WEBHOOK_SECRET not configured in production. Refusing to start.');
  process.exit(1);
}

const port = process.env.PORT || 3000;
serve({ fetch: app.fetch, port });
console.log('WebhookMail running on port ' + port);
// Trigger redeploy
