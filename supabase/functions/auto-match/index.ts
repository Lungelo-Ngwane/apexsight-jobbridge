import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import OpenAI from "https://esm.sh/openai@4.28.0";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


Deno.serve(async (req) => {

  const { job_id } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const openai = new OpenAI({
    apiKey: Deno.env.get("OPENAI_API_KEY")
  });


  // STEP 1: Get Job

  const { data: job } = await supabase
    .from("jobs")
    .select(`
      id,
      title,
      description,
      location,
      employment_type,
      experience_level
    `)
    .eq("id", job_id)
    .single();



  // STEP 2: Get Job Skills (JOIN skills table)

  const { data: jobSkills } = await supabase
    .from("job_skills")
    .select(`
      required,
      min_score,
      skills (
        name
      )
    `)
    .eq("job_id", job_id);



  // STEP 3: Format skills

  const requiredSkills = jobSkills
    ?.filter(s => s.required)
    .map(s => `${s.skills.name} (${s.min_score || 0}%)`)
    .join(", ");


  const optionalSkills = jobSkills
    ?.filter(s => !s.required)
    .map(s => `${s.skills.name}`)
    .join(", ");



  // STEP 4: Create embedding text

  const embeddingText = `

  Job Title:
  ${job.title}

  Description:
  ${job.description}

  Location:
  ${job.location}

  Employment Type:
  ${job.employment_type}

  Experience Level:
  ${job.experience_level}

  Required Skills:
  ${requiredSkills}

  Optional Skills:
  ${optionalSkills}

  `;



  // STEP 5: Generate embedding

  const embeddingResponse = await openai.embeddings.create({

    model: "text-embedding-3-small",

    input: embeddingText

  });


  const embedding = embeddingResponse.data[0].embedding;



  // STEP 6: Save embedding

  await supabase
    .from("jobs")
    .update({ embedding })
    .eq("id", job_id);



  // STEP 7: Match candidates

  const { data: matches } = await supabase.rpc(
    "match_candidates",
    {
      job_embedding: embedding,
      match_threshold: 0.40,
      match_count: 50
    }
  );



  // STEP 8: Save matches

  if (matches) {

    for (const match of matches) {

      await supabase
        .from("job_matches")
        .upsert({
          job_id: job_id,
          candidate_id: match.id,
          similarity: match.similarity
        });

    }

  }



  return new Response(

    JSON.stringify({

      success: true,

      matches_found: matches?.length || 0

    }),

    { headers: { "Content-Type": "application/json" } }

  );

});
