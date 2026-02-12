import { serve } from "https://deno.land/std/http/server.ts";
import { Resend } from "npm:resend";
import { createClient } from "npm:@supabase/supabase-js";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL");
const supabaseServiceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing SUPABASE_URL/PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY",
  );
}

const supabase = createClient(supabaseUrl ?? "", supabaseServiceKey ?? "", {
  auth: { persistSession: false },
});

serve(async (req) => {
  // Handle OPTIONS preflight request first
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*", // later restrict to your domain
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, x-client-info, apikey",
      },
    });
  }

  // Headers for actual response
  const headers = {
    "Access-Control-Allow-Origin": "*", // later change "*" to your domain
    "Content-Type": "application/json",
  };

  try {
    const payload = await req.json();
    const { type, data } = payload;
    const applicationId = data?.applicationId as string | undefined;

    if (!applicationId) {
      return new Response(JSON.stringify({ error: "Missing applicationId" }), {
        status: 400,
        headers,
      });
    }

    const { data: application, error: applicationError } = await supabase
      .from("job_applications")
      .select(
        `
        id,
        candidate_profiles (
          id,
          user_id,
          full_name
        ),
        jobs (
          id,
          title,
          employer_id,
          employer_profiles (
            id,
            company_name,
            user_id
          )
        )
      `,
      )
      .eq("id", applicationId)
      .single();

    if (applicationError || !application) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers,
      });
    }

    const jobTitle = application.jobs?.title ?? "the role";
    const companyName =
      application.jobs?.employer_profiles?.company_name ?? "the company";

    const candidateUserId = application.candidate_profiles?.user_id;
    const employerUserId = application.jobs?.employer_profiles?.user_id;

    const candidateUser = candidateUserId
      ? await supabase.auth.admin.getUserById(candidateUserId)
      : null;
    const employerUser = employerUserId
      ? await supabase.auth.admin.getUserById(employerUserId)
      : null;

    const candidateEmail = candidateUser?.data?.user?.email ?? null;
    const employerEmail = employerUser?.data?.user?.email ?? null;

    if (type === "APPLICATION_CREATED") {
      if (candidateEmail) {
        await resend.emails.send({
          from: "ApexSight Talent Infrastructure <notifications@apexsight.co.za>",
          to: candidateEmail,
          subject: `Application received – ${jobTitle}`,
          html: `
            <p>Hi,</p>
            <p>Your application for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> was submitted successfully.</p>
            <p>We’ll notify you if there’s an update.</p>
          `,
        });
      }

      if (employerEmail) {
        await resend.emails.send({
          from: "ApexSight Talent Infrastructure <notifications@apexsight.co.za>",
          to: employerEmail,
          subject: `New application – ${jobTitle}`,
          html: `
            <p>You’ve received a new application for <strong>${jobTitle}</strong>.</p>
            <p>Log in to review the candidate.</p>
          `,
        });
      }
    }

    if (type === "CANDIDATE_SHORTLISTED") {
      if (candidateEmail) {
        await resend.emails.send({
          from: "ApexSight Talent Infrastructure <notifications@apexsight.co.za>",
          to: candidateEmail,
          subject: `🎉 You’ve been shortlisted – ${jobTitle}`,
          html: `
            <p>Great news!</p>
            <p>You’ve been shortlisted for <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p>
            <p>Please log in to view next steps.</p>
          `,
        });
      }
    }

    console.log("Candidate email:", candidateEmail);
    console.log("Employer email:", employerEmail);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Failed to send email" }), {
      status: 500,
      headers,
    });
  }
});
