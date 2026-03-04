import { serve } from "https://deno.land/std/http/server.ts";
import { Resend } from "npm:resend";
import { createClient } from "npm:@supabase/supabase-js";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL");
const supabaseServiceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
const appBaseUrl =
  Deno.env.get("FRONTEND_URL") ??
  Deno.env.get("APP_URL") ??
  Deno.env.get("VITE_APP_URL") ??
  "https://apexsight-jobbridge-3c9eb.ondigitalocean.app";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing SUPABASE_URL/PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY",
  );
}

const supabase = createClient(supabaseUrl ?? "", supabaseServiceKey ?? "", {
  auth: { persistSession: false },
});

type SupportedEmailType = "APPLICATION_CREATED" | "CANDIDATE_SHORTLISTED";

async function sendEmailOrThrow(args: {
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const result = await resend.emails.send(args);
  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }
  return result.data?.id ?? null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailShell(params: {
  preheader: string;
  statusLabel: string;
  heading: string;
  intro: string;
  details?: Array<{ label: string; value: string }>;
  ctaLabel: string;
  ctaUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;
  supportNote?: string;
}) {
  const detailsRows =
    params.details && params.details.length > 0
      ? params.details
          .map(
            (item) => `
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:13px;width:140px;">${escapeHtml(item.label)}</td>
                <td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:600;">${escapeHtml(item.value)}</td>
              </tr>
            `,
          )
          .join("")
      : "";

  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;visibility:hidden;">
      ${escapeHtml(params.preheader)}
    </div>
    <div style="margin:0;padding:24px;background:#eef2ff;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe3f5;border-radius:18px;overflow:hidden;box-shadow:0 16px 50px rgba(15,23,42,.08);">
        <tr>
          <td style="padding:24px 28px;background:linear-gradient(130deg,#0f172a,#1d4ed8 50%,#3b82f6);color:#ffffff;">
            <div style="font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;opacity:.82;">ApexSight JobBridge</div>
            <div style="margin-top:8px;font-size:24px;font-weight:700;line-height:1.2;">Hiring Activity Update</div>
            <div style="margin-top:12px;display:inline-block;padding:7px 12px;border:1px solid rgba(255,255,255,.45);border-radius:999px;font-size:12px;font-weight:600;background:rgba(255,255,255,.14);">
              ${escapeHtml(params.statusLabel)}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 28px 22px 28px;">
            <h1 style="margin:0 0 12px 0;font-size:26px;line-height:1.2;color:#0f172a;letter-spacing:-0.01em;">${escapeHtml(params.heading)}</h1>
            <p style="margin:0 0 20px 0;font-size:15px;line-height:1.65;color:#334155;">${escapeHtml(params.intro)}</p>
            ${
              detailsRows
                ? `<div style="margin:14px 0 22px 0;padding:18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#475569;margin-bottom:10px;">Application Snapshot</div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${detailsRows}</table>
                  </div>`
                : ""
            }
            <a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 20px;border-radius:10px;">${escapeHtml(params.ctaLabel)}</a>
            <a href="${escapeHtml(params.secondaryCtaUrl)}" style="display:inline-block;margin-left:10px;color:#1d4ed8;text-decoration:none;font-size:14px;font-weight:600;padding:12px 2px;">${escapeHtml(params.secondaryCtaLabel)} -&gt;</a>
            <p style="margin:18px 0 0 0;font-size:12px;line-height:1.5;color:#64748b;">
              ${escapeHtml(
                params.supportNote ?? "If you did not expect this email, you can safely ignore it.",
              )}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;line-height:1.6;color:#64748b;">
            This is an automated message from ApexSight JobBridge. Please do not reply directly.
          </td>
        </tr>
      </table>
    </div>
  `;
}

serve(async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, x-client-info, apikey",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY secret" }), {
        status: 500,
        headers,
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers,
      });
    }

    const {
      data: { user: actor },
      error: actorError,
    } = await supabase.auth.getUser(token);

    if (actorError || !actor) {
      return new Response(JSON.stringify({ error: "Invalid user session" }), {
        status: 401,
        headers,
      });
    }

    const payload = await req.json();
    const type = String(payload?.type ?? "") as SupportedEmailType;
    const data = payload?.data;
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

    const jobTitle = String(application.jobs?.title ?? "the role");
    const companyName = String(
      application.jobs?.employer_profiles?.company_name ?? "the company",
    );
    const candidateName = String(application.candidate_profiles?.full_name ?? "Candidate");

    const candidateUserId = application.candidate_profiles?.user_id;
    const employerUserId = application.jobs?.employer_profiles?.user_id;

    if (type === "APPLICATION_CREATED" && candidateUserId !== actor.id) {
      return new Response(JSON.stringify({ error: "Forbidden for this application" }), {
        status: 403,
        headers,
      });
    }

    if (type === "CANDIDATE_SHORTLISTED" && employerUserId !== actor.id) {
      return new Response(JSON.stringify({ error: "Forbidden for this application" }), {
        status: 403,
        headers,
      });
    }

    const candidateUser = candidateUserId
      ? await supabase.auth.admin.getUserById(candidateUserId)
      : null;
    const employerUser = employerUserId
      ? await supabase.auth.admin.getUserById(employerUserId)
      : null;

    if (candidateUser?.error) {
      throw new Error(`Failed to resolve candidate user email: ${candidateUser.error.message}`);
    }
    if (employerUser?.error) {
      throw new Error(`Failed to resolve employer user email: ${employerUser.error.message}`);
    }

    const candidateEmail = candidateUser?.data?.user?.email ?? null;
    const employerEmail = employerUser?.data?.user?.email ?? null;
    const sent: { recipient: string; messageId: string | null }[] = [];

    if (type === "APPLICATION_CREATED") {
      if (candidateEmail) {
        const messageId = await sendEmailOrThrow({
          from: "ApexSight JobBridge <notifications@apexsight.co.za>",
          to: candidateEmail,
          subject: `Application Received - ${jobTitle}`,
          html: emailShell({
            preheader: `Application confirmed for ${jobTitle} at ${companyName}.`,
            statusLabel: "Application Submitted",
            heading: "Your application has been received",
            intro: "Your application was successfully submitted and is now under employer review.",
            details: [
              { label: "Role", value: jobTitle },
              { label: "Company", value: companyName },
              { label: "Candidate", value: candidateName },
            ],
            ctaLabel: "Open Candidate Dashboard",
            ctaUrl: `${appBaseUrl}/candidate/dashboard`,
            secondaryCtaLabel: "Track This Role",
            secondaryCtaUrl: `${appBaseUrl}/candidate/applications`,
            supportNote: "You will be notified in real time when your application status changes.",
          }),
        });
        sent.push({ recipient: candidateEmail, messageId });
      }

      if (employerEmail) {
        const messageId = await sendEmailOrThrow({
          from: "ApexSight JobBridge <notifications@apexsight.co.za>",
          to: employerEmail,
          subject: `New Application - ${jobTitle}`,
          html: emailShell({
            preheader: `New candidate application received for ${jobTitle}.`,
            statusLabel: "New Candidate",
            heading: "A new candidate has applied",
            intro: "A new application is ready for review in your hiring pipeline.",
            details: [
              { label: "Role", value: jobTitle },
              { label: "Company", value: companyName },
              { label: "Candidate", value: candidateName },
            ],
            ctaLabel: "Review Candidate",
            ctaUrl: `${appBaseUrl}/employer/jobs`,
            secondaryCtaLabel: "Open Hiring Pipeline",
            secondaryCtaUrl: `${appBaseUrl}/employer/dashboard`,
            supportNote: "Open your pipeline to shortlist, message, or progress this applicant.",
          }),
        });
        sent.push({ recipient: employerEmail, messageId });
      }
    }

    if (type === "CANDIDATE_SHORTLISTED") {
      if (candidateEmail) {
        const messageId = await sendEmailOrThrow({
          from: "ApexSight JobBridge <notifications@apexsight.co.za>",
          to: candidateEmail,
          subject: `You have been shortlisted - ${jobTitle}`,
          html: emailShell({
            preheader: `You have been shortlisted for ${jobTitle} at ${companyName}.`,
            statusLabel: "Shortlisted",
            heading: "You have been shortlisted",
            intro:
              "Great news. The employer has shortlisted your application and may contact you with next steps.",
            details: [
              { label: "Role", value: jobTitle },
              { label: "Company", value: companyName },
            ],
            ctaLabel: "View Application Status",
            ctaUrl: `${appBaseUrl}/candidate/dashboard`,
            secondaryCtaLabel: "Prepare for Interview",
            secondaryCtaUrl: `${appBaseUrl}/candidate/profile`,
            supportNote: "Keep your profile and messages up to date to avoid missing interview requests.",
          }),
        });
        sent.push({ recipient: candidateEmail, messageId });
      }
    }

    if (type !== "APPLICATION_CREATED" && type !== "CANDIDATE_SHORTLISTED") {
      return new Response(JSON.stringify({ error: "Unsupported notification type" }), {
        status: 400,
        headers,
      });
    }

    if (sent.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No recipient emails found for this application",
          applicationId,
        }),
        {
          status: 404,
          headers,
        },
      );
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to send email";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers,
    });
  }
});
