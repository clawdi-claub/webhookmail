import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { nanoid } from 'nanoid';
import db from './db.js';

const app = new Hono();
app.use('*', cors());

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'webhookmail' }));

// Create webhook endpoint
app.post('/api/webhooks', async (c) => {
  const { email, name } = await c.req.json();
  
  if (!email || !email.includes('@')) {
    return c.json({ error: 'Valid email required' }, 400);
  }
  
  const id = nanoid(12);
  const created = new Date().toISOString();
  
  db.createWebhook(id, email, name || null, created);
  
  return c.json({
    id,
    email,
    webhookUrl: `https://webhookmail.onrender.com/webhook/${id}`,
    dashboardUrl: `https://webhookmail.onrender.com/dashboard/${id}`
  });
});

// Receive webhook
app.post('/webhook/:id', async (c) => {
  const { id } = c.req.param();
  const webhook = db.getWebhook(id);
  
  if (!webhook) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Get request details
  const method = c.req.method;
  const headers = Object.fromEntries(c.req.raw.headers);
  const body = await c.req.text();
  const timestamp = new Date().toISOString();
  
  // Log the webhook
  db.logWebhook(id, method, JSON.stringify(headers), body, timestamp);
  
  // Send email via Resend
  if (RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'webhook@webhookmail.app',
          to: webhook.email,
          subject: `Webhook received: ${method} ${id.slice(0, 6)}`,
          html: `
            <h2>Webhook Received</h2>
            <p><strong>ID:</strong> ${id}</p>
            <p><strong>Time:</strong> ${timestamp}</p>
            <p><strong>Method:</strong> ${method}</p>
            <h3>Headers:</h3>
            <pre>${JSON.stringify(headers, null, 2)}</pre>
            <h3>Body:</h3>
            <pre>${body}</pre>
          `
        })
      });
      
      if (!response.ok) {
        console.error('Resend error:', await response.text());
      }
    } catch (e) {
      console.error('Email send failed:', e);
    }
  }
  
  return c.json({ received: true, id });
});

// Get webhook stats
app.get('/api/webhooks/:id', (c) => {
  const { id } = c.req.param();
  const webhook = db.getWebhook(id);
  
  if (!webhook) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  const logs = db.getWebhookLogs(id, 20);
  
  return c.json({
    ...webhook,
    logs,
    webhookUrl: `https://webhookmail.onrender.com/webhook/${id}`
  });
});

serve({ fetch: app.fetch, port: process.env.PORT || 3000 });
console.log('WebhookMail running on port', process.env.PORT || 3000);
