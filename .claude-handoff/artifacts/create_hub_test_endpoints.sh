#!/bin/bash
# Creates 2 test-mode Stripe webhook endpoints pointing at the thecros hub fns
# Returns their whsec values which need to be pasted into Lovable Cloud secrets

set -e

echo "=== Creating stripe-hub-platform test-mode endpoint ==="
PLATFORM_RESP=$(curl -sS -X POST "https://api.stripe.com/v1/webhook_endpoints" \
  -d "url=https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/stripe-hub-platform" \
  -d "description=CROS platform hub (test-mode validation)" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=customer.subscription.created" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=invoice.payment_succeeded" \
  -d "enabled_events[]=invoice.payment_failed" \
  -d "enabled_events[]=payment_intent.succeeded" \
  -d "enabled_events[]=payment_intent.payment_failed" \
  -d "api_version=2025-08-27.basil")

PLATFORM_ID=$(echo "$PLATFORM_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
PLATFORM_SECRET=$(echo "$PLATFORM_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['secret'])")

echo "  ID: $PLATFORM_ID"
echo "  Secret (STRIPE_HUB_PLATFORM_WEBHOOK_SECRET): $PLATFORM_SECRET"
echo ""

echo "=== Creating stripe-hub-connect test-mode endpoint (Connect variant) ==="
CONNECT_RESP=$(curl -sS -X POST "https://api.stripe.com/v1/webhook_endpoints" \
  -d "url=https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/stripe-hub-connect" \
  -d "description=CROS Connect hub (test-mode validation)" \
  -d "connect=true" \
  -d "enabled_events[]=account.updated" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=customer.subscription.created" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=invoice.payment_succeeded" \
  -d "enabled_events[]=invoice.payment_failed" \
  -d "enabled_events[]=payment_intent.succeeded" \
  -d "enabled_events[]=payment_intent.payment_failed" \
  -d "enabled_events[]=payout.paid" \
  -d "enabled_events[]=payout.failed" \
  -d "api_version=2025-08-27.basil")

CONNECT_ID=$(echo "$CONNECT_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
CONNECT_SECRET=$(echo "$CONNECT_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['secret'])")

echo "  ID: $CONNECT_ID"
echo "  Secret (STRIPE_HUB_CONNECT_WEBHOOK_SECRET): $CONNECT_SECRET"
echo ""

echo "=== Written to /tmp/cros_secrets/hub_webhook_secrets.env ==="
mkdir -p /tmp/cros_secrets
umask 077
cat > /tmp/cros_secrets/hub_webhook_secrets.env <<INNER
# Stripe hub webhook secrets (test-mode)
# Generated: $(date -Iseconds)
# Paste these into Lovable Cloud → thecros → Secrets

STRIPE_HUB_PLATFORM_WEBHOOK_SECRET=$PLATFORM_SECRET
STRIPE_HUB_CONNECT_WEBHOOK_SECRET=$CONNECT_SECRET

# Endpoint IDs (for later deletion during blue/green cutover):
STRIPE_HUB_PLATFORM_ENDPOINT_ID=$PLATFORM_ID
STRIPE_HUB_CONNECT_ENDPOINT_ID=$CONNECT_ID
INNER
chmod 600 /tmp/cros_secrets/hub_webhook_secrets.env

echo "  chmod 600 applied"
