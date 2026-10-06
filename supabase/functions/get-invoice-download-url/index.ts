import { requestObject } from "../_shared/http.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { resolveEmployerContext } from "../_shared/employer.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const { invoiceId } = await requestObject(req);

    if (!token) return jsonResponse({ error: "Missing access token" }, 401);
    if (!invoiceId) return jsonResponse({ error: "Missing invoiceId" }, 400);

    let employer;
    try {
      employer = await resolveEmployerContext(supabase, token, {
        requiredRoles: ["owner", "admin"],
      });
    } catch {
      return jsonResponse({ error: "Employer profile not found" }, 404);
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("billing_invoices")
      .select("id, invoice_number, storage_path")
      .eq("id", invoiceId)
      .eq("employer_id", employer.employerId)
      .maybeSingle();

    if (invoiceError || !invoice) return jsonResponse({ error: "Invoice not found" }, 404);
    if (!invoice.storage_path) return jsonResponse({ error: "Invoice file not available" }, 404);

    const { data: signed, error: signedError } = await supabase.storage
      .from("billing-invoices")
      .createSignedUrl(String(invoice.storage_path), 60);

    if (signedError || !signed?.signedUrl) {
      return jsonResponse({ error: "The request could not be completed" }, 500);
    }

    return jsonResponse({
      url: signed.signedUrl,
      filename: `${String(invoice.invoice_number)}.txt`,
    });
  } catch {
    return jsonResponse({ error: "The request could not be completed" }, 500);
  }
});
