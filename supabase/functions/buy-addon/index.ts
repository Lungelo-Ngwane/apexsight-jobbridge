import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { resolveEmployerContext } from "../_shared/employer.ts";
import { bearerToken,failure,json,methodResponse,requestObject } from "../_shared/http.ts";
import { positiveInteger,safeReturnPath } from "../_shared/payment-validation.ts";
import { paystack } from "../_shared/payments.ts";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async req => {
  const method = methodResponse(req); if (method) return method;
  try {
    let employer;
    try { employer = await resolveEmployerContext(db, bearerToken(req), { requiredRoles: ["owner", "admin"] }); }
    catch { return json({ error: "Unauthorized" }, 401); }
    const body = await requestObject(req);

    const { data: item, error } = await db.from("addons").select("id, name, price, type, credits").eq("id", body.addonId).eq("active", true).maybeSingle();
    if (error || !item) return json({ error: "Add-on not found" }, 404);
    const amount = positiveInteger(Number(item.price));
    const credits = positiveInteger(Number(item.credits));
    const metadata = { employerId: employer.employerId, addonId: item.id, kind: "addon" };
    const entitlement = { addon_id: item.id, credits, credit_type: String(item.type) };
    const extra = {};
    const callbackPath = '/employer/addons?addon_success=true&return_to=' + encodeURIComponent(safeReturnPath(body.returnTo));

    const reference = 'jb_' + crypto.randomUUID().replaceAll('-', '');
    const inserted = await db.from("checkout_intents").insert({ reference, employer_id: employer.employerId,
      kind: "addon", amount_minor: amount, currency: "ZAR", ...entitlement });
    if (inserted.error) throw new Error("Checkout intent persistence failed");
    const appUrl = new URL(Deno.env.get("APP_URL") ?? Deno.env.get("FRONTEND_URL") ?? "http://localhost:5173");
    const checkout = await paystack('transaction/initialize', { email: employer.user.email, amount, currency: "ZAR",
      reference, callback_url: new URL(callbackPath, appUrl.origin).toString(), metadata, ...extra });

    return json({ authorization_url: checkout.authorization_url, access_code: checkout.access_code, reference });
  } catch(error) { return failure(error); }
});
