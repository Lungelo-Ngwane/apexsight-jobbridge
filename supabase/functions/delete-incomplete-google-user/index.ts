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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing authorization token." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unable to resolve authenticated user." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const identityProviders = (user.identities ?? [])
      .map((identity) => String(identity.provider ?? "").toLowerCase())
      .filter(Boolean);
    const appMetadataProvider = String(user.app_metadata?.provider ?? "").toLowerCase();
    const appMetadataProviders = Array.isArray(user.app_metadata?.providers)
      ? user.app_metadata.providers.map((provider) => String(provider ?? "").toLowerCase()).filter(Boolean)
      : [];
    const allProviders = Array.from(new Set([
      ...identityProviders,
      appMetadataProvider,
      ...appMetadataProviders,
    ].filter(Boolean)));
    const isGoogleUser = allProviders.includes("google");

    if (!isGoogleUser) {
      return new Response(JSON.stringify({
        deleted: false,
        reason: "not_google_user",
        providers: allProviders,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedRole = String(profile?.role ?? "").trim().toLowerCase();
    if (resolvedRole === "candidate" || resolvedRole === "employer" || resolvedRole === "admin") {
      return new Response(JSON.stringify({
        deleted: false,
        reason: "profile_exists",
        role: resolvedRole,
        providers: allProviders,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ deleted: true, providers: allProviders }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
