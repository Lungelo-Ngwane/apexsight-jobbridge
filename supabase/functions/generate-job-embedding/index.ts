import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "https://esm.sh/openai@4.28.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

Deno.serve(async (req) => {

  const { job_id } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get job
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", job_id)
    .single();

  const text = `
  Title: ${job.title}
  Description: ${job.description}
  Requirements: ${job.requirements}
  Location: ${job.location}
  `;

  // Generate embedding
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  // Save embedding
  await supabase
    .from("jobs")
    .update({
      embedding: embedding.data[0].embedding
    })
    .eq("id", job_id);

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { "Content-Type": "application/json" } }
  );
});
