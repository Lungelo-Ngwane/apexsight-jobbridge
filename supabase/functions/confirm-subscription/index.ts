import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { resolveEmployerContext } from "../_shared/employer.ts";
import { bearerToken,failure,json,methodResponse,requestObject } from "../_shared/http.ts";
import { paymentReference } from "../_shared/payment-validation.ts";
import { fulfillPayment } from "../_shared/payments.ts";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async req => {
  const method = methodResponse(req); if (method) return method;
  try {
    let employer;
    try { employer = await resolveEmployerContext(db, bearerToken(req), { requiredRoles: ["owner", "admin"] }); }
    catch { return json({ error: "Unauthorized" }, 401); }
    const body = await requestObject(req);
    return json(await fulfillPayment(db, paymentReference(body.reference), employer.employerId, "subscription"));
  } catch(error) { return failure(error); }
});
