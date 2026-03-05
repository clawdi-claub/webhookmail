import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { nanoid } from 'nanoid';
import db from './db.js';
import { landingPage, dashboardPage } from './pages.js';
import { createCheckoutSession, handleWebhook, isConfigured } from './stripe.js';

const app = new Hono();
app.use('*', cors());

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FREE_LIMIT = 50;
const BASE_URL = process.env.BASE_URL || 'https://webhookmail.onrender.com';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

app.get('/health', (c) => c.json({ status: 'ok', service: 'webhookmail' }));

app.get('/', (c) => c.html(landingPage()));

// Create endpoint
app.post('/api/endpoints', async (c) => {
  const { email, name } = await c.req.json();
  if (!email || !email.includes('@')) {
    return c.json({ error: 'Valid email required' }, 400);
  }
  const id = nanoid(12);
  const now = new Date().toISOString();
  db.createEndpoint(id, email, name || 'My Webhook', now);
  return c.json({
    id, email,
    name: name || 'My Webhook',
    webhookUrl: BASE_URL + '/hook/' + id,
    dashboardUrl: BASE_URL + '/dashboard/' + id,
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

// Dashboard
app.get('/dashboard/:id', (c) => {
  const { id } = c.req.param();
  const endpoint = db.getEndpoint(id);
  if (!endpoint) return c.html('<h1>Not found</h1>', 404);
  const logs = db.getLogs(id, 50);
  const monthly = db.getMonthlyCount(id);
  return c.html(dashboardPage(endpoint, logs, monthly));
});

// API: endpoint info
app.get('/api/endpoints/:id', (c) => {
  const { id } = c.req.param();
  const endpoint = db.getEndpoint(id);
  if (!endpoint) return c.json({ error: 'Not found' }, 404);
  const logs = db.getLogs(id, 20);
  const monthly = db.getMonthlyCount(id);
  return c.json({ ...endpoint, logs, monthlyUsage: monthly, webhookUrl: BASE_URL + '/hook/' + id });
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
  const rawBody = await c.req.text();
  const sig = c.req.header('stripe-signature');
  const result = await handleWebhook(rawBody, sig);

  if (result.action === 'upgrade' && result.endpointId) {
    db.upgradeTier(result.endpointId, 'pro', result.customerId, result.subscriptionId);
  } else if (result.action === 'downgrade') {
    db.downgradeBySubscription(result.subscriptionId);
  }

  return c.json({ received: true });
});

const port = process.env.PORT || 3000;
serve({ fetch: app.fetch, port });
console.log('WebhookMail running on port ' + port);
