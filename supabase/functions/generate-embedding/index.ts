import { serve } from "https://deno.land/std/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.28.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {

  const { profile_id } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const openai = new OpenAI({
    apiKey: Deno.env.get("OPENAI_API_KEY"),
  });


  const { data: profile, error } = await supabase
    .from("candidate_profiles")
    .select("*")
    .eq("id", profile_id)
    .single();


  if (error || !profile) {

    return new Response("Profile not found", { status: 404 });

  }


  const text = `

  Title: ${profile.title}

  Skills: ${profile.skills?.join(", ")}

  Experience: ${profile.years_experience}

  Bio: ${profile.bio}

  `;


  const embeddingResponse = await openai.embeddings.create({

    model: "text-embedding-3-small",

    input: text,

  });


  const embedding = embeddingResponse.data[0].embedding;


  await supabase

    .from("candidate_profiles")

    .update({

      embedding: embedding,

    })

    .eq("id", profile_id);



  return new Response("Embedding created");

});
