import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { resolveEmployerContext } from "../_shared/employer.ts";
import { bearerToken,failure,json,methodResponse,requestObject } from "../_shared/http.ts";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
Deno.serve(async req => {
  const method = methodResponse(req); if(method) return method;
  try {
    let employer; try { employer = await resolveEmployerContext(db, bearerToken(req)); }
    catch { return json({ error: "Unauthorized" }, 401); }
    const { applicationId } = await requestObject(req);
    if(typeof applicationId !== 'string' || !/^[a-f0-9-]{36}$/i.test(applicationId)) return json({ error: "Invalid application" }, 400);
    const { data, error } = await db.rpc('unlock_candidate', { p_employer_id: employer.employerId, p_application_id: applicationId });
    if(error) return json({ error: "Candidate access unavailable or insufficient credits" }, 402);
    return json(data);
  } catch(error) { return failure(error); }
});
