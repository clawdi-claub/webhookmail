# WebhookMail - Production Readiness Checklist

## ✅ Code Security (COMPLETED)

- [x] **Stripe webhook signature verification** - Hard fail if `STRIPE_WEBHOOK_SECRET` missing
- [x] **Rate limiting** - 20/hr on `/api/endpoints`, 120/min on `/hook/*`, 10/min on `/api/upgrade/*`
- [x] **Body size limit** - 1MB max request size
- [x] **Security headers** - HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- [x] **CORS restricted** - API routes limited to same-origin
- [x] **Email validation** - RFC-compliant regex, 254 character limit
- [x] **Free tier enforcement** - 50 webhooks/month limit

## 🔴 Environment Variables (REQUIRED BEFORE PRODUCTION)

Set these in Render dashboard (or your hosting provider):

```bash
# Stripe (REQUIRED)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# Email delivery (REQUIRED for webhook forwarding)
RESEND_API_KEY=re_...

# App config
BASE_URL=https://webhookmail.onrender.com
NODE_ENV=production
```

## 🔴 Stripe Configuration (REQUIRED)

1. **Create product in Stripe Dashboard:**
   - Name: WebhookMail Pro
   - Price: $3/month (recurring)
   - Copy the Price ID → `STRIPE_PRICE_ID`

2. **Get API keys:**
   - Settings → Developers → API keys
   - Secret key → `STRIPE_SECRET_KEY`

3. **Create webhook endpoint:**
   - Settings → Developers → Webhooks → Add endpoint
   - URL: `https://webhookmail.onrender.com/stripe/webhook`
   - Events to listen:
     - `checkout.session.completed`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
   - Copy Signing secret → `STRIPE_WEBHOOK_SECRET`

4. **Test payment flow:**
   - Use Stripe test mode first
   - Create test product with test price
   - Run through checkout flow
   - Verify webhook fires and Pro tier activates
   - Test cancellation flow

## 🔴 Resend Email Configuration (REQUIRED)

1. **Sign up at resend.com**
2. **Create API key** → `RESEND_API_KEY`
3. **Verify domain** (optional but recommended):
   - Add DNS records for `webhookmail.app` or your domain
   - Set verified domain as sender

4. **Test email delivery:**
   - Create endpoint
   - Send test webhook
   - Verify email arrives in inbox

## 🟡 Testing Checklist (BEFORE GOING LIVE)

- [ ] Health endpoint responds: `curl https://webhookmail.onrender.com/health`
- [ ] Create endpoint works (free tier)
- [ ] Webhook delivery works (email received)
- [ ] Free tier limit enforced (50/month)
- [ ] Checkout flow completes successfully
- [ ] Webhook signature verification passes
- [ ] Pro tier activates after payment
- [ ] Unlimited webhooks work after upgrade
- [ ] Cancellation downgrades tier correctly
- [ ] Rate limiting triggers at threshold
- [ ] Security headers present (check with curl -I)
- [ ] 1MB body limit enforced (413 on larger payloads)

## 🟡 Monitoring

After launch, monitor:
- Render logs for errors
- Stripe dashboard for failed payments
- Resend dashboard for email delivery stats
- Database size (WAL files)
- Rate limit hits (429 responses)
- Monthly webhook counts per endpoint

## 🚀 Deployment

Push to master triggers auto-deploy on Render. Verify:
1. Build completes successfully
2. Health check passes
3. No errors in deployment logs

---

**Last security audit:** 2026-03-06  
**Status:** Code ready, env vars pending configuration
