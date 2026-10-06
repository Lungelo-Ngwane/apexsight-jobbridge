import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { processPaymentEvent } from "./payments.ts";

function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
async function lifecycle(state: string, event: string) {
  const originalFetch = globalThis.fetch;
  const updates: Record<string, unknown>[] = [];
  Deno.env.set("PAYSTACK_SECRET_KEY", "fictional-provider-key");
  globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({ status: true, data: { status: state } }), {
    headers: { "content-type": "application/json" },
  }))) as typeof fetch;
  const db = {
    from(table: string) {
      assert(table === "employer_profiles", "Lifecycle must only touch employer profiles");
      return {
        select() { return this; }, eq() { return this; },
        maybeSingle() { return Promise.resolve({ data: { id: "fictional-employer", paystack_subscription_code: "fictional-subscription" }, error: null }); },
        update(value: Record<string, unknown>) {
          updates.push(value);
          const result = { eq() { return result; }, then(resolve: (value: {error: null}) => unknown) { return Promise.resolve({ error: null }).then(resolve); } };
          return result;
        },
      };
    },
  } as unknown as SupabaseClient;
  try { await processPaymentEvent(db, { event, data: { subscription_code: "fictional-subscription" } }); return updates; }
  finally { globalThis.fetch = originalFetch; }
}
Deno.test("an out-of-order disable cannot cancel a currently active subscription", async () => {
  assert((await lifecycle("active", "subscription.disable")).length === 0, "Active subscription must stay active");
});
Deno.test("non-renewing access remains until provider confirms cancellation", async () => {
  assert((await lifecycle("non-renewing", "subscription.disable")).length === 0, "Non-renewing period must retain access");
  const updates = await lifecycle("cancelled", "subscription.disable");
  assert(updates.length === 1 && updates[0].plan === "free", "Confirmed cancellation must downgrade once");
});
Deno.test("stale payment failure cannot override a now-active subscription", async () => {
  assert((await lifecycle("active", "invoice.payment_failed")).length === 0, "Recovered payment must retain active access");
  const updates = await lifecycle("attention", "invoice.payment_failed");
  assert(updates.length === 1 && updates[0].subscription_status === "past_due", "Current failure must be represented");
});
