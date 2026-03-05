// Stripe integration for WebhookMail Pro ($3/mo)
// Requires: STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const BASE_URL = process.env.BASE_URL || 'https://webhookmail.onrender.com';

async function stripeRequest(path, method, body) {
  const res = await fetch('https://api.stripe.com/v1' + path, {
    method,
    headers: {
      'Authorization': 'Bearer ' + STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  return res.json();
}

export async function createCheckoutSession(endpointId, email, priceId) {
  return stripeRequest('/checkout/sessions', 'POST', {
    'mode': 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'customer_email': email,
    'success_url': BASE_URL + '/upgrade/success?endpoint=' + endpointId,
    'cancel_url': BASE_URL + '/dashboard/' + endpointId,
    'metadata[endpoint_id]': endpointId,
    'allow_promotion_codes': 'true',
  });
}

export async function handleWebhook(rawBody, signature) {
  // Verify webhook signature using Stripe's method
  // For now, parse the event directly (add signature verification in production)
  const event = JSON.parse(rawBody);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const endpointId = session.metadata?.endpoint_id;
      if (endpointId) {
        return { action: 'upgrade', endpointId, customerId: session.customer, subscriptionId: session.subscription };
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      return { action: 'downgrade', subscriptionId: sub.id, customerId: sub.customer };
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      return { action: 'payment_failed', customerId: invoice.customer };
      break;
    }
  }
  return { action: 'none' };
}

export function isConfigured() {
  return !!(STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}
