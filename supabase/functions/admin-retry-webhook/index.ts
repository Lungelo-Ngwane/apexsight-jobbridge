import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { bearerToken,failure,json,methodResponse,requestObject } from "../_shared/http.ts";
import { record } from "../_shared/payment-validation.ts";
import { processClaimedEvent } from "../_shared/payments.ts";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
Deno.serve(async req => {
  const method = methodResponse(req); if (method) return method;
  try {
    const { data: { user }, error } = await db.auth.getUser(bearerToken(req));
    if (error || !user) return json({ error: "Unauthorized" }, 401);
    const admin = await db.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (admin.error || !admin.data) return json({ error: "Forbidden" }, 403);
    const body = await requestObject(req);
    const row = await db.from('payment_webhook_events').select('event_key, payload, status').eq('id', body.eventId).single();
    if (row.error || !row.data) return json({ error: "Event not found" }, 404);
    const result = await processClaimedEvent(db, record(row.data.payload), row.data.event_key);
    const audit = await db.from('admin_audit_logs').insert({ actor_user_id: user.id, action: 'webhook_retried', details: { eventId: body.eventId } });
    if (audit.error) throw new Error('Audit persistence failed');
    return json({ success: true, retried: true, ...result });
  } catch(error) { return failure(error); }
});
