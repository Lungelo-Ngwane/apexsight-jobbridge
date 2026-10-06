import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { boundedText,failure,json,methodResponse } from "../_shared/http.ts";
import { record,verifySignature } from "../_shared/payment-validation.ts";
import { processClaimedEvent } from "../_shared/payments.ts";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
Deno.serve(async req => {
  const method = methodResponse(req); if (method) return method;
  try {
    const raw = await boundedText(req, 262144);
    if (!await verifySignature(raw, req.headers.get('x-paystack-signature'), Deno.env.get('PAYSTACK_SECRET_KEY') ?? ''))
      return json({ error: "Invalid signature" }, 401);
    const payload = record(JSON.parse(raw)), data = record(payload.data);
    const event = String(payload.event ?? '');
    if (!event) return json({ error: "Missing event" }, 400);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    // charge.success uses payment identity; lifecycle events may share a subscription id.
    const identity = event === 'charge.success' ? String(data.reference ?? data.id ?? hash) : hash;
    const result = await processClaimedEvent(db, payload, 'paystack:' + event + ':' + identity);
    return json({ received: true, ...result });
  } catch(error) { return failure(error); }
});
