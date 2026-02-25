# Design ApexSight Talent Platform - Product & Operations Guide (Non-Technical)

## 1. Purpose of This Guide

This document is for product managers, operations teams, customer success, support, sales, and leadership.

It explains:

- What the platform does
- How each user group uses it
- How plans, credits, and upgrades work operationally
- How to support customers and resolve common issues
- What to monitor to measure business performance

This guide intentionally avoids engineering implementation details.

---

## 2. Platform in Plain Language

Design ApexSight Talent Platform connects employers and candidates through:

- `SkillLink` for candidates
- `JobBridge` for employers

The platform helps employers find better candidates by combining:

- Candidate profile information
- Skills and work experience
- CV-based intelligence
- Match scoring and ranking

---

## 3. Primary User Types

## 3.1 Candidate

Goals:

- Build a complete profile
- Upload CV
- Add skills and experience
- Apply for jobs
- Improve visibility to employers

## 3.2 Employer

Goals:

- Complete onboarding and choose a plan
- Post jobs
- Review and rank applicants
- View candidate profiles
- Use AI matching features (plan/credit dependent)
- Manage billing, add-ons, and team settings

---

## 4. Core Product Journeys

## 4.1 Candidate Journey

1. Sign up as candidate
2. Complete profile (headline, bio, location, experience)
3. Add skills
4. Upload CV
5. Apply to relevant jobs
6. Receive messages from employers

Operational note:

- CV upload triggers candidate profile enrichment and improved matching signals.

## 4.2 Employer Journey

1. Sign up as employer
2. Complete onboarding (company + plan)
3. Post jobs
4. Review applicants in pipeline stages
5. Open profile details and make shortlist/interview/reject decisions
6. Manage subscription and purchase add-ons when needed

---

## 5. Plans, Credits, and Upsell Logic

## 5.1 Plans (business behavior)

- `Free`: very limited access for trial/start
- `Starter`: entry paid plan with practical limits
- `Professional`: expanded access with more premium visibility
- `Enterprise`: full visibility and advanced controls

## 5.2 Add-ons/Credits

Add-ons can unlock actions when limits are reached (for example AI-related actions or profile unlock-style actions).

## 5.3 Score Visibility Rules (current product behavior)

- Starter without AI credit: score panel hidden in profile details, shown with upsell actions
- Professional: score summary shown, detailed match breakdown hidden
- Enterprise: full score summary and full breakdown shown

This structure supports plan differentiation and conversion to higher tiers.

---

## 6. AI Matching in Product Terms

The platform presents:

- Application score
- AI similarity
- Hybrid score
- Match level
- Recommendation
- Rank

What operations should know:

- Score updates may depend on both plan/credit status and matching refresh events
- CV improvements can update candidate quality signals
- If AI credits are unavailable, certain AI match refresh behaviors can be limited by policy

---

## 7. Operational Playbooks

## 7.1 New Employer Enablement Checklist

1. Verify employer completed onboarding
2. Confirm active plan
3. Confirm first job posted successfully
4. Confirm applicants are visible
5. Confirm employer understands candidate pipeline actions
6. Confirm billing/add-ons page is accessible and clear

## 7.2 Candidate Profile Quality Checklist

1. Full name present
2. Headline and bio present
3. Skills added
4. CV uploaded
5. Experience information present

Higher profile quality improves matching and employer confidence.

## 7.3 When Match Scores “Don’t Change”

Support steps:

1. Confirm candidate CV upload succeeded
2. Confirm candidate profile has updated skills/experience fields
3. Confirm employer plan and AI credits
4. Trigger or wait for matching refresh flow
5. Re-check score components (required, optional, experience, proficiency)
6. Confirm optional skill expectations align with product policy

## 7.4 Billing and Upgrade Support

1. Validate current subscription status
2. Confirm plan tier and next upgrade path
3. Review invoice history and payment references
4. If features are locked by plan, route user to upgrade path
5. If locked by credits, route user to relevant add-on purchase path

---

## 8. Customer Support FAQ (Ops Version)

## Q: Candidate uploaded CV but employer still sees old score

A:

- CV upload can succeed before all ranking views are refreshed.
- Ask user to reopen profile and trigger refresh cycle.
- Verify plan/credit conditions if AI portions are not visible/updating.

## Q: Why is score hidden for some employers?

A:

- Score visibility depends on subscription tier and AI credit state.
- Starter without AI credits gets upsell actions instead of score details.

## Q: Why does one employer see breakdown while another does not?

A:

- Detailed breakdown is enterprise-level visibility.

## Q: User says “payment succeeded but features didn’t unlock”

A:

- Verify subscription confirmation and add-on confirmation events.
- Check invoice and credit balances.
- Escalate with payment reference if inconsistent.

---

## 9. Product KPIs to Track

## 9.1 Activation

- Candidate profile completion rate
- Candidate CV upload rate
- Employer onboarding completion rate
- Time to first job post

## 9.2 Marketplace Health

- Applications per job
- Employer response rate
- Candidate-to-interview conversion

## 9.3 Matching Quality

- Distribution of match levels
- Employer shortlist rate from top-ranked candidates
- Interview recommendation acceptance rate

## 9.4 Revenue and Expansion

- Plan conversion (Free -> Starter -> Professional -> Enterprise)
- Add-on purchase rate
- Credit consumption patterns
- Churn and downgrade reasons

---

## 10. Incident and Escalation Framework

## Severity Levels

- `SEV-1`: Core hiring flow blocked (login, job posting, applications unavailable)
- `SEV-2`: Major premium/billing/matching outage
- `SEV-3`: Partial feature degradation or isolated account issues

## Escalation Data to Collect

- User role and account email
- Exact action attempted
- Timestamp and timezone
- Plan tier
- Credit balance (if relevant)
- Payment reference (if billing-related)
- Screenshots/error text

## Communication Template (Customer-facing)

- Acknowledge issue
- State impact clearly
- Give workaround (if available)
- Provide expected next update window
- Confirm when resolved

---

## 11. Release Readiness Checklist (Ops)

Before release:

1. Confirm plan gating behavior is documented
2. Confirm support scripts and FAQs updated
3. Confirm billing/upgrade flows tested
4. Confirm critical journeys tested (candidate apply, employer review, messaging)
5. Confirm internal team briefed on behavior changes

After release:

1. Monitor error and support ticket volume
2. Track conversion and usage shifts
3. Log top confusion points and update onboarding/help copy

---

## 12. Team Responsibilities (Suggested)

- Product: roadmap, feature definitions, KPI ownership
- Operations: process execution, release coordination, support readiness
- Customer Success: onboarding and account adoption
- Support: issue triage and resolution
- Engineering: platform reliability, fixes, and enhancements
- Finance/Revenue Ops: billing accuracy and reconciliation

---

## 13. Recommended Next Non-Technical Assets

1. Employer onboarding playbook (1-page)
2. Candidate profile quality playbook (1-page)
3. Billing escalation SOP
4. Weekly KPI dashboard definitions
5. “What changed this release” stakeholder template

