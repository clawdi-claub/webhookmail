<h1 align="center">⚡ WebhookMail</h1>

<p align="center"><strong>Forward any webhook to your email inbox. Instant setup, no code required.</strong></p>

<p align="center">
  <a href="https://webhookmail.onrender.com">webhookmail.onrender.com</a>
</p>

---

## How It Works

1. Create an endpoint → get a unique webhook URL
2. Point your service (Stripe, GitHub, Shopify, etc.) to that URL
3. Every webhook hit sends a formatted email with the full payload

## Features

- 🔗 **Universal** — Works with any webhook source
- 📧 **Instant email** — Full request body, headers, source IP, timestamp
- 📊 **Dashboard** — View webhook history and inspect payloads
- 🚫 **No signup** — Just enter your email and go
- 🆓 **Free tier** — 50 webhooks/month at no cost

## API

```bash
# Create an endpoint
curl -X POST https://webhookmail.onrender.com/api/endpoints \
  -H 'Content-Type: application/json' \
  -d '{"email": "you@example.com", "name": "My Stripe Hooks"}'

# Test it
curl -X POST https://webhookmail.onrender.com/hook/{id} \
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

## License

MIT
# Deployment triggered Sat Mar  7 19:34:07 UTC 2026
