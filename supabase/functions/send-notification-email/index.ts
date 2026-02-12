import { serve } from "https://deno.land/std/http/server.ts";
import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  // Handle OPTIONS preflight request first
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*", // later restrict to your domain
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info",
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

    if (type === "APPLICATION_CREATED") {
      const { candidateEmail, jobTitle, companyName, employerEmail } = data;

      // Email candidate
      await resend.emails.send({
        from: "ApexSight Talent Infrastructure <apexsight@resend.dev>",
        to: candidateEmail,
        subject: `Application received – ${jobTitle}`,
        html: `
          <p>Hi,</p>
          <p>Your application for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> was submitted successfully.</p>
          <p>We’ll notify you if there’s an update.</p>
        `
      });

      // Email employer
      await resend.emails.send({
        from: "ApexSight Talent Infrastructure <apexsight@resend.dev>",
        to: employerEmail,
        subject: `New application – ${jobTitle}`,
        html: `
          <p>You’ve received a new application for <strong>${jobTitle}</strong>.</p>
          <p>Log in to review the candidate.</p>
        `
      });
    }

    if (type === "CANDIDATE_SHORTLISTED") {
      const { candidateEmail, jobTitle, companyName } = data;

      await resend.emails.send({
        from: "ApexSight Talent Infrastructure <apexsight@resend.dev>",
        to: candidateEmail,
        subject: `🎉 You’ve been shortlisted – ${jobTitle}`,
        html: `
          <p>Great news!</p>
          <p>You’ve been shortlisted for <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p>
          <p>Please log in to view next steps.</p>
        `
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Failed to send email" }), { status: 500, headers });
  }
});
