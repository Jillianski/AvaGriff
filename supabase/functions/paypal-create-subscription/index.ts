import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function paypalAccessToken() {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_SECRET");
  const base = Deno.env.get("PAYPAL_API_BASE") ?? "https://api-m.sandbox.paypal.com";
  if (!clientId || !secret) throw new Error("PayPal server credentials are not configured.");
  const credentials = btoa(`${clientId}:${secret}`);
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error("PayPal authentication failed.");
  const data = await response.json();
  return { token: data.access_token as string, base };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authorization = request.headers.get("Authorization") ?? "";
    const jwt = authorization.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Sign in before starting a subscription." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) return json({ error: "Your sign-in session is invalid." }, 401);

    const body = await request.json().catch(() => ({}));
    const plan = body?.plan;
    const planId = plan === "premium_monthly"
      ? Deno.env.get("PAYPAL_MONTHLY_PLAN_ID")
      : plan === "premium_annual"
      ? Deno.env.get("PAYPAL_ANNUAL_PLAN_ID")
      : null;
    if (!planId) return json({ error: "Choose a valid subscription plan." }, 400);

    const appOrigin = Deno.env.get("APP_ORIGIN");
    if (!appOrigin || !/^https:\/\//i.test(appOrigin)) {
      return json({ error: "The secure app return URL is not configured." }, 500);
    }

    const { token, base } = await paypalAccessToken();
    const response = await fetch(`${base}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": crypto.randomUUID(),
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: userData.user.id,
        application_context: {
          brand_name: "AvaGriff",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${appOrigin}/?paypal=return`,
          cancel_url: `${appOrigin}/?paypal=cancel`,
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      console.error("PayPal subscription creation failed", response.status, result?.name);
      return json({ error: "PayPal could not start checkout. Please try again." }, 502);
    }
    const approvalUrl = result.links?.find((link: { rel: string; href: string }) => link.rel === "approve")?.href;
    if (!approvalUrl || !/^https:\/\//i.test(approvalUrl)) {
      return json({ error: "PayPal did not return a valid approval link." }, 502);
    }
    return json({ approvalUrl });
  } catch (error) {
    console.error("PayPal checkout error", error);
    return json({ error: "Unable to start checkout right now." }, 500);
  }
});
