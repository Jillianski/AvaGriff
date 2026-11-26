import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function getPayPalToken(base: string, clientId: string, secret: string) {
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error("PayPal OAuth failed");
  return (await response.json()).access_token as string;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const rawBody = await request.text();
    const event = JSON.parse(rawBody);
    const base = Deno.env.get("PAYPAL_API_BASE") ?? "https://api-m.sandbox.paypal.com";
    const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const secret = Deno.env.get("PAYPAL_SECRET");
    const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!clientId || !secret || !webhookId || !serviceRole || !supabaseUrl) {
      return new Response("Webhook is not configured", { status: 500 });
    }

    const header = (name: string) => request.headers.get(name) ?? "";
    const transmission = {
      auth_algo: header("paypal-auth-algo"),
      cert_url: header("paypal-cert-url"),
      transmission_id: header("paypal-transmission-id"),
      transmission_sig: header("paypal-transmission-sig"),
      transmission_time: header("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    };
    if (Object.values(transmission).some((value) => !value)) {
      return new Response("Missing signature information", { status: 400 });
    }

    const token = await getPayPalToken(base, clientId, secret);
    const verification = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(transmission),
    });
    const verificationResult = await verification.json();
    if (!verification.ok || verificationResult.verification_status !== "SUCCESS") {
      return new Response("Invalid webhook signature", { status: 401 });
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const eventId = event.id;
    const eventType = event.event_type;
    if (!eventId || !eventType) return new Response("Invalid event", { status: 400 });

    const resource = event.resource ?? {};
    const subscriptionId = resource.id && String(resource.id).startsWith("I-")
      ? resource.id
      : resource.billing_agreement_id ?? resource.subscription_id;
    const customUserId = resource.custom_id;
    const planId = resource.plan_id ?? resource.billing_info?.plan_id;
    const monthlyPlanId = Deno.env.get("PAYPAL_MONTHLY_PLAN_ID");
    const annualPlanId = Deno.env.get("PAYPAL_ANNUAL_PLAN_ID");
    const plan = planId === monthlyPlanId ? "premium_monthly"
      : planId === annualPlanId ? "premium_annual" : null;

    const activeEvents = new Set(["BILLING.SUBSCRIPTION.ACTIVATED", "BILLING.SUBSCRIPTION.UPDATED"]);
    const inactiveEvents = new Set([
      "BILLING.SUBSCRIPTION.CANCELLED",
      "BILLING.SUBSCRIPTION.EXPIRED",
      "BILLING.SUBSCRIPTION.SUSPENDED",
    ]);
    if (activeEvents.has(eventType) || inactiveEvents.has(eventType)) {
      const providerStatus = String(resource.status ?? "").toUpperCase();
      const status = providerStatus === "ACTIVE" ? "active"
        : providerStatus === "CANCELLED" || eventType.endsWith("CANCELLED") ? "cancelled"
        : providerStatus === "EXPIRED" || eventType.endsWith("EXPIRED") ? "expired"
        : providerStatus === "SUSPENDED" || eventType.endsWith("SUSPENDED") ? "suspended"
        : "inactive";
      const userId = customUserId;
      if (!userId || !subscriptionId || !plan) {
        console.error("Verified PayPal subscription event lacked required mapping", eventType);
        return new Response("Subscription mapping is incomplete; retry after correction.", { status: 500 });
      }
      const periodEnd = resource.billing_info?.next_billing_time ?? null;
      const { error } = await admin.from("subscriptions").upsert({
        user_id: userId,
        provider: "paypal",
        provider_customer_id: resource.subscriber?.payer_id ?? null,
        provider_subscription_id: subscriptionId,
        plan,
        status,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
    }

    // Record only after all required processing succeeds, so PayPal retries can recover
    // from transient database errors instead of being incorrectly marked as handled.
    const { error: ledgerError } = await admin.from("paypal_webhook_events")
      .insert({ event_id: eventId, event_type: eventType });
    if (ledgerError?.code === "23505") return new Response("Already processed", { status: 200 });
    if (ledgerError) throw ledgerError;

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("PayPal webhook processing error", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
});
