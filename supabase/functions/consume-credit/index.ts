import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { resolveEmployerContext } from "../_shared/employer.ts";
import { bearerToken,failure,json,methodResponse,requestObject } from "../_shared/http.ts";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
Deno.serve(async req => {
  const method = methodResponse(req); if(method) return method;
  try {
    let employer; try { employer = await resolveEmployerContext(db, bearerToken(req)); }
    catch { return json({ error: "Unauthorized" }, 401); }
    const { creditType, amount = 1 } = await requestObject(req);
    if(typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1 || amount > 1000 ||
      !['ai_credit', 'ai_report', 'featured_job', 'candidate_unlock', 'auto_shortlist', 'job_slot'].includes(String(creditType))) return json({ error: "Invalid credit request" }, 400);
    const { data, error } = await db.rpc('consume_employer_credit', { p_employer_id: employer.employerId, p_credit_type: creditType, p_amount: amount });
    if(error) return json({ error: "Insufficient credits" }, 402);
    return json({ success: true, creditType, consumed: amount, remaining: data });
  } catch(error) { return failure(error); }
});
