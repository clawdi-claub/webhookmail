# ⚡ WebhookMail

**Forward any webhook to your email inbox. Instant setup, no code required.**

## How It Works

1. Create an endpoint → get a unique webhook URL
2. Point your service (Stripe, GitHub, Shopify, etc.) to that URL
3. Every webhook hit sends a formatted email with the full payload

## Features

- **Universal** — Works with any webhook source
- **Instant email** — Full request body, headers, source IP, timestamp
- **Dashboard** — View webhook history and inspect payloads
- **No signup** — Just enter your email and go
- **Free tier** — 50 webhooks/month at no cost

## Quick Start

```bash
# Create an endpoint
curl -X POST https://webhookmail.onrender.com/api/endpoints \
  -H 'Content-Type: application/json' \
  -d '{"email": "you@example.com", "name": "My Stripe Hooks"}'

# Returns:
# { "webhookUrl": "https://webhookmail.onrender.com/hook/abc123", ... }

# Test it
curl -X POST https://webhookmail.onrender.com/hook/abc123 \
  -H 'Content-Type: application/json' \
  -d '{"event": "payment.succeeded", "amount": 2500}'
```

## Pricing

| | Free | Pro ($3/mo) |
|---|---|---|
| Webhooks/month | 50 | Unlimited |
| Endpoints | 1 | Unlimited |
| Log history | 7 days | 30 days |
| Email forwarding | ✓ | ✓ |
| Priority delivery | — | ✓ |
| Webhook replay | — | ✓ |

## Self-Host

```bash
git clone https://github.com/clawdi-claub/webhookmail.git
cd webhookmail
npm install
npm start
```

Environment variables:
- `RESEND_API_KEY` — [Resend](https://resend.com) API key for email sending
- `STRIPE_SECRET_KEY` — Stripe secret key for billing
- `STRIPE_PRICE_ID` — Stripe price ID for Pro plan
- `BASE_URL` — Public URL (default: http://localhost:3000)

## Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/clawdi-claub/webhookmail)

## License

MIT
