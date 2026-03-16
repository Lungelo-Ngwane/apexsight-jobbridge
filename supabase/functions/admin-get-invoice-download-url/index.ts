import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAdminUser(token: string) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) throw new Error("Not authenticated.");

  const { data: adminRow, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !adminRow?.user_id) throw new Error("Admin access required.");

  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const { invoiceId } = await req.json();

    if (!token) return jsonResponse({ error: "Missing access token" }, 401);
    if (!invoiceId) return jsonResponse({ error: "Missing invoiceId" }, 400);

    const adminUser = await requireAdminUser(token);

    const { data: invoice, error: invoiceError } = await supabase
      .from("billing_invoices")
      .select("id, invoice_number, storage_path")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError || !invoice) return jsonResponse({ error: "Invoice not found" }, 404);
    if (!invoice.storage_path) return jsonResponse({ error: "Invoice file not available" }, 404);

    const { data: signed, error: signedError } = await supabase.storage
      .from("billing-invoices")
      .createSignedUrl(String(invoice.storage_path), 60);

    if (signedError || !signed?.signedUrl) {
      return jsonResponse({ error: signedError?.message ?? "Failed to create download URL" }, 500);
    }

    await supabase.from("admin_audit_logs").insert({
      actor_user_id: adminUser.id,
      action: "invoice_download_requested",
      details: {
        invoiceId: String(invoice.id),
        invoiceNumber: String(invoice.invoice_number ?? ""),
      },
    });

    return jsonResponse({
      url: signed.signedUrl,
      filename: `${String(invoice.invoice_number)}.txt`,
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
