import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {

  const { job_id } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get job embedding
  const { data: job } = await supabase
    .from("jobs")
    .select("embedding")
    .eq("id", job_id)
    .single();

  // Run matching function
const { data: matches } = await supabase.rpc("match_candidates", {
  job_embedding: job.embedding,
  match_threshold: 0.40,
  match_count: 20
});



  return new Response(
    JSON.stringify(matches),
    { headers: { "Content-Type": "application/json" } }
  );

});
