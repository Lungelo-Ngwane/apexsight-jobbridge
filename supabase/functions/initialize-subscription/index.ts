import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { resolveEmployerContext } from "../_shared/employer.ts";
import { bearerToken,failure,json,methodResponse,requestObject } from "../_shared/http.ts";
import { positiveInteger } from "../_shared/payment-validation.ts";
import { paystack } from "../_shared/payments.ts";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async req => {
  const method = methodResponse(req); if (method) return method;
  try {
    let employer;
    try { employer = await resolveEmployerContext(db, bearerToken(req), { requiredRoles: ["owner", "admin"] }); }
    catch { return json({ error: "Unauthorized" }, 401); }
    const body = await requestObject(req);

    let query = db.from("plans").select("id, name, price_monthly, paystack_plan_code, paystack_test_plan_code").eq("active", true);
    query = body.planId ? query.eq("id", body.planId) : query.ilike("name", String(body.planName ?? ""));
    const { data: item, error } = await query.maybeSingle();
    if (error || !item) return json({ error: "Plan not found" }, 404);
    const plan = String(item.name).trim().toLowerCase();
    if (!["starter", "professional", "enterprise"].includes(plan)) return json({ error: "Invalid plan" }, 400);
    // Catalog prices are consistently ZAR minor units, not guessed from magnitude.
    const amount = positiveInteger(Number(item.price_monthly));
    const test = String(Deno.env.get("PAYSTACK_SECRET_KEY") ?? "").startsWith("sk_test_");
    const planCode = test ? item.paystack_test_plan_code : item.paystack_plan_code;
    if (!planCode) return json({ error: "Plan is not configured for this payment environment" }, 503);
    const metadata = { employerId: employer.employerId, targetPlan: plan, planId: item.id };
    const entitlement = { plan_name: plan, provider_plan_code: String(planCode) };
    const extra = { plan: String(planCode) };
    const callbackPath = '/employer/billing?success=true';

    const reference = 'jb_' + crypto.randomUUID().replaceAll('-', '');
    const inserted = await db.from("checkout_intents").insert({ reference, employer_id: employer.employerId,
      kind: "subscription", amount_minor: amount, currency: "ZAR", ...entitlement });
    if (inserted.error) throw new Error("Checkout intent persistence failed");
    const appUrl = new URL(Deno.env.get("APP_URL") ?? Deno.env.get("FRONTEND_URL") ?? "http://localhost:5173");
    const checkout = await paystack('transaction/initialize', { email: employer.user.email, amount, currency: "ZAR",
      reference, callback_url: new URL(callbackPath, appUrl.origin).toString(), metadata, ...extra });

    // Starting an upgrade must not revoke an existing paid subscription before payment.
    const pending = await db.from("employer_profiles").update({ selected_plan: plan }).eq("id", employer.employerId);
    if (pending.error) throw new Error("Pending plan persistence failed");

    return json({ authorization_url: checkout.authorization_url, access_code: checkout.access_code, reference });
  } catch(error) { return failure(error); }
});
