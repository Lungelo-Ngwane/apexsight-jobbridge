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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const { reference } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: employer, error: employerError } = await supabase
      .from("employer_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (employerError || !employer?.id) {
      return new Response(JSON.stringify({ error: "Employer profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingPurchase } = await supabase
      .from("employer_addon_purchases")
      .select("id, addon_id, credits_added")
      .eq("reference", reference)
      .maybeSingle();

    if (existingPurchase?.id) {
      return new Response(
        JSON.stringify({
          success: true,
          alreadyProcessed: true,
          reference,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
        },
      },
    );

    const verifyPayload = await verifyResponse.json();

    if (!verifyResponse.ok || !verifyPayload?.status) {
      return new Response(
        JSON.stringify({
          error: verifyPayload?.message ?? "Failed to verify add-on payment",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const paymentStatus = String(verifyPayload?.data?.status ?? "");
    if (paymentStatus !== "success") {
      return new Response(JSON.stringify({ error: "Payment not successful" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = (verifyPayload?.data?.metadata ?? {}) as Record<string, unknown>;
    const addonId = String(metadata.addonId ?? "").trim();
    const employerId = String(metadata.employerId ?? "").trim();

    if (!addonId || !employerId || employerId !== employer.id) {
      return new Response(
        JSON.stringify({ error: "Transaction metadata does not match this employer" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: addon, error: addonError } = await supabase
      .from("addons")
      .select("id, type, credits")
      .eq("id", addonId)
      .maybeSingle();

    if (addonError || !addon) {
      return new Response(JSON.stringify({ error: "Add-on not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creditsToAdd = Number(addon.credits ?? 0);
    if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid credit quantity for add-on" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { error: purchaseError } = await supabase
      .from("employer_addon_purchases")
      .insert({
        employer_id: employer.id,
        addon_id: addon.id,
        reference,
        amount_paid: Number(verifyPayload?.data?.amount ?? 0),
        status: "success",
      });

    if (purchaseError) {
      if (purchaseError.code === "23505") {
        return new Response(
          JSON.stringify({ success: true, alreadyProcessed: true, reference }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({ error: `Failed to record purchase: ${purchaseError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: existingCredit } = await supabase
      .from("employer_credits")
      .select("id, remaining")
      .eq("employer_id", employer.id)
      .eq("credit_type", addon.type)
      .maybeSingle();

    if (existingCredit?.id) {
      const { error: updateCreditError } = await supabase
        .from("employer_credits")
        .update({ remaining: Number(existingCredit.remaining ?? 0) + creditsToAdd })
        .eq("id", existingCredit.id);

      if (updateCreditError) {
        return new Response(
          JSON.stringify({ error: `Failed to update credits: ${updateCreditError.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    } else {
      const { error: insertCreditError } = await supabase
        .from("employer_credits")
        .insert({
          employer_id: employer.id,
          credit_type: addon.type,
          remaining: creditsToAdd,
        });

      if (insertCreditError) {
        return new Response(
          JSON.stringify({ error: `Failed to add credits: ${insertCreditError.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const { error: markPurchaseError } = await supabase
      .from("employer_addon_purchases")
      .update({ credits_added: creditsToAdd })
      .eq("reference", reference);

    if (markPurchaseError) {
      return new Response(
        JSON.stringify({ error: `Failed to finalize purchase: ${markPurchaseError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        reference,
        creditType: addon.type,
        creditsAdded: creditsToAdd,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
