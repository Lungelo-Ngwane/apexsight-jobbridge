# Design ApexSight Talent Platform Test Cases

Last updated: `2026-03-14`

## 1. Scope

This test suite is based on the code currently present in:

- `src/app/*`
- `src/lib/*`
- `supabase/functions/*`
- `supabase/migrations/*`
- `PROJECT_DOCUMENTATION.md`

It covers:

- Frontend flows for candidates and employers
- Backend/frontend contract behavior through Supabase queries and edge functions
- Subscription plans, billing, add-ons, credits, and feature gating
- Messaging, matching, CV analysis, AI reports, and notifications
- Security, access control, and regression checks

Notes:

- Some UI areas in `EmployerSettingsPage.tsx` are present but currently static or not wired to persistence. Those are still listed as UI validation cases and marked accordingly.
- Plan behavior is driven by both frontend state and backend enforcement. Priority should be given to backend enforcement outcomes.

## 2. Test Data Setup

Prepare at least these accounts:

- `candidate_complete`: candidate with full profile, CV uploaded, skills, certifications, assessments
- `candidate_incomplete`: candidate missing CV and/or skills
- `candidate_other`: second candidate for messaging and access isolation
- `employer_free`: employer on `free`, onboarding complete
- `employer_trial`: employer with active trial
- `employer_starter`: employer with active `starter`
- `employer_professional`: employer with active `professional`
- `employer_enterprise`: employer with active `enterprise`
- `employer_pending_payment`: employer with `selected_plan` set and `subscription_status = pending_payment`

Seed supporting data:

- At least 10 skills in `skills`
- At least 5 jobs across open/closed/archived states
- Jobs with featured and non-featured states
- Jobs with expiry dates near today and already expired
- Applications across statuses: `applied`, `shortlisted`, `interview`, `rejected`, `hired`
- Add-ons for `featured_job`, `ai_report`, `ai_credit`, `candidate_profile_view`, `job_slot`
- Billing invoices in `pending`, `paid`, and `failed` states
- Credit balances with both zero and positive remaining values

## 3. Priority Smoke Suite

Run these first after every deployment:

| ID | Area | Test | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| SMK-01 | Auth | Candidate can register, log in, and land on candidate area | Account created, role resolved, route redirect works | Pending | |
| SMK-02 | Auth | Employer can register, complete onboarding, and open dashboard | Onboarding persists and dashboard loads | Pending | |
| SMK-03 | Candidate Jobs | Candidate can browse jobs and apply once | Application created, duplicate blocked | Pending | |
| SMK-04 | Candidate Profile | Candidate can upload CV and save profile | CV stored, profile updated, refresh pipeline triggered | Pending | |
| SMK-05 | Employer Jobs | Employer can create a job and see it in active jobs | Job appears with correct status and metadata | Pending | |
| SMK-06 | Employer Billing | Paid employer can load billing page and invoices | Plans, usage, invoices, and totals render | Pending | |
| SMK-07 | Add-ons | Employer can start add-on checkout flow | Checkout redirect starts successfully | Pending | |
| SMK-08 | Messaging | Employer and candidate can exchange a message | Thread exists, message appears in real time | Pending | |
| SMK-09 | AI | Employer can run auto-match on eligible job | Function succeeds and returns match count | Pending | |
| SMK-10 | Security | Free employer cannot access paid-only candidates/messages routes | Redirect to employer dashboard | Pending | |
| SMK-11 | Candidate Profile | Candidate can select availability from dropdown and save profile | Selected option persists after reload | Pending | |
| SMK-12 | Employer Onboarding | Existing company name pre-populates on onboarding step 0 | Company name field loads prior profile value | Pending | |

## 4. Authentication And Routing

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| AUT-01 | User logged out | Open `/` | Home page loads | Pending | |
| AUT-02 | User logged out | Open `/candidate/jobs` directly | App redirects to `/` | Pending | |
| AUT-03 | User logged out | Open `/employer/dashboard` directly | App redirects to `/` | Pending | |
| AUT-04 | New candidate | Register with valid email/password/full name | Registration succeeds and confirmation flow begins | Pending | |
| AUT-05 | New employer | Register without company name | Registration blocked with company-name error | Pending | |
| AUT-06 | Existing user | Log in with valid credentials | Session created and role resolved from `profiles` | Pending | |
| AUT-07 | Candidate user | Log in from `/` first time | Redirect to `/candidate/dashboard` | Pending | |
| AUT-08 | Candidate user who has seen dashboard before | Log in from `/` again | Redirect to `/candidate/jobs` | Pending | |
| AUT-09 | Employer user | Log in from `/` | Redirect to `/employer/dashboard` | Pending | |
| AUT-10 | Invalid credentials | Log in with wrong password | Auth error shown, session not created | Pending | |
| AUT-11 | Session near expiry | Trigger authed action | Session refresh occurs, action still succeeds | Pending | |
| AUT-12 | Expired invalid session | Trigger authed action | User receives sign-in/session-expired error | Pending | |
| AUT-13 | Google OAuth configured | Start Google sign-in | OAuth redirect starts successfully | Pending | |

## 5. Candidate Frontend

### 5.1 Candidate Dashboard

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| CND-DASH-01 | Candidate logged in | Open dashboard | Welcome state, readiness score, skills, docs, quick actions render | Pending | |
| CND-DASH-02 | Candidate with no assessments | Open dashboard | Empty assessment state shown | Pending | |
| CND-DASH-03 | Candidate with assessments in multiple states | Open dashboard | Completed/in-progress/not-started visual states are correct | Pending | |
| CND-DASH-04 | Candidate with CV uploaded | Open dashboard | CV filename is shown | Pending | |
| CND-DASH-05 | Candidate without CV | Open dashboard | "No CV uploaded yet" shown | Pending | |
| CND-DASH-06 | Candidate uploads valid CV file | Select `.pdf/.doc/.docx/.txt` file | File uploads, profile reloads, success dialog appears | Pending | |
| CND-DASH-07 | Candidate uploads invalid/blocked file | Select unsupported file type | Browser or backend prevents upload; no silent success | Pending | |
| CND-DASH-08 | Candidate clicks "View Matching Jobs" | From dashboard click button | Navigate to `/candidate/jobs` | Pending | |
| CND-DASH-09 | Candidate adds skill from modal | Add valid skill | Skill persists and dashboard refreshes | Pending | |
| CND-DASH-10 | Candidate opens messages action | Click "Open Messages" | Navigate to `/candidate/messages` | Pending | |

### 5.2 Candidate Profile

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| CND-PROF-01 | Candidate logged in | Open `/candidate/profile` | Existing profile fields load | Pending | |
| CND-PROF-02 | Candidate with no existing profile row | Open profile and save fields | New profile row is created | Pending | |
| CND-PROF-03 | Candidate edits core fields | Save changes | Profile updates persist | Pending | |
| CND-PROF-04 | Candidate adds valid skill from skills catalog | Add skill and save | Skill row inserted with correct `skill_id` | Pending | |
| CND-PROF-05 | Candidate adds unknown skill text | Add skill not in catalog | User gets "Skill not found" feedback | Pending | |
| CND-PROF-06 | Candidate adds same skill twice | Repeat add | Duplicate add is prevented | Pending | |
| CND-PROF-07 | Candidate changes skill level | Change dropdown level | Level persists and remains after reload | Pending | |
| CND-PROF-08 | Candidate removes skill | Click remove on a skill chip | Skill row deleted and removed from UI | Pending | |
| CND-PROF-09 | Candidate saves profile after edits | Save | Success feedback shown | Pending | |
| CND-PROF-10 | Any successful save/add/remove skill | Perform action | Matching refresh pipeline is triggered without blocking save | Pending | |
| CND-PROF-11 | Candidate opens availability dropdown | Inspect options | Only `Immediately`, `30 days notice`, and `1 calendar month` are available | Pending | |
| CND-PROF-12 | Candidate selects `Immediately` | Save and reload profile | Availability persists as `Immediately` | Pending | |
| CND-PROF-13 | Candidate selects `30 days notice` | Save and reload profile | Availability persists as `30 days notice` | Pending | |
| CND-PROF-14 | Candidate selects `1 calendar month` | Save and reload profile | Availability persists as `1 calendar month` | Pending | |
| CND-PROF-15 | Candidate leaves availability blank | Save profile | Field persists as null/empty without validation failure | Pending | |

### 5.3 Candidate Jobs

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| CND-JOB-01 | Open jobs exist | Open `/candidate/jobs` | Open jobs load with employer details | Pending | |
| CND-JOB-02 | Featured and normal jobs exist | Open jobs page | Featured jobs are prioritized visually | Pending | |
| CND-JOB-03 | Candidate searches by title/company/location/description | Enter query | Matching jobs remain, non-matching jobs are filtered out | Pending | |
| CND-JOB-04 | Job list has multiple employment types | Apply type filter | Only matching jobs remain | Pending | |
| CND-JOB-05 | Job list has multiple locations | Apply location filter | Only matching jobs remain | Pending | |
| CND-JOB-06 | Job list has multiple experience levels | Apply level filter | Only matching jobs remain | Pending | |
| CND-JOB-07 | Filters applied | Click clear all/reset | All filters clear and pagination resets to page 1 | Pending | |
| CND-JOB-08 | More than 9 matching jobs | Navigate pagination controls | Page changes correctly and count label stays correct | Pending | |
| CND-JOB-09 | Candidate opens job card | Click card or details button | Job details view opens | Pending | |
| CND-JOB-10 | Candidate saves job | Click bookmark | Job id stored in local storage and UI updates | Pending | |
| CND-JOB-11 | Candidate unsaves job | Click bookmark again | Saved state is removed from local storage and UI updates | Pending | |
| CND-JOB-12 | Complete candidate profile | Click Apply | Application succeeds and success modal appears | Pending | |
| CND-JOB-13 | Incomplete candidate profile | Click Apply | Completion modal opens and user is sent to profile flow if chosen | Pending | |
| CND-JOB-14 | Candidate already applied | Click Apply again | UI stays in applied state; duplicate prevented | Pending | |
| CND-JOB-15 | Duplicate application row exists check | Submit same job twice quickly | Only one application is persisted | Pending | |
| CND-JOB-16 | ENV `VITE_ENFORCE_JOB_EXPIRY=true` and expired jobs exist | Open jobs page | Expired jobs are excluded | Pending | |
| CND-JOB-17 | Employer profile restricted by RLS | Load open jobs | Jobs still load with fallback employer metadata | Pending | |

### 5.4 Candidate My Jobs

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| CND-MJ-01 | Candidate has applied jobs | Open `/candidate/my-jobs` | Applied tab shows applied jobs | Pending | |
| CND-MJ-02 | Candidate has saved jobs | Switch to saved tab | Saved tab shows saved jobs | Pending | |
| CND-MJ-03 | Candidate has none | Open page | Empty state shown with CTA to browse jobs | Pending | |
| CND-MJ-04 | Some jobs later closed/archived | Open page | Status badge reflects non-open state | Pending | |

## 6. Employer Frontend

### 6.1 Employer Onboarding And Guard Rails

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| EMP-ONB-01 | Employer profile missing or still loading | Open employer area | Loader shown first, then safe fallback if profile missing | Pending | |
| EMP-ONB-02 | `onboarding_step < 3` | Open any employer route | Onboarding flow appears instead of layout | Pending | |
| EMP-ONB-03 | Step 0 values empty | Click Continue | Button disabled until required fields entered | Pending | |
| EMP-ONB-04 | Step 0 valid values | Continue | Company data saved and step advances | Pending | |
| EMP-ONB-05 | Active trial employer | Open step 1 | Trial messaging shown instead of paid plan selection | Pending | |
| EMP-ONB-06 | Non-trial employer selects Free | Continue | Plan becomes `free`, status `inactive`, step advances | Pending | |
| EMP-ONB-07 | Non-trial employer selects paid plan | Continue | `selected_plan` set, plan remains `free`, status becomes `pending_payment` | Pending | |
| EMP-ONB-08 | Step 2 complete | Click "Go to Dashboard" | `onboarding_step` becomes 3 and employer lands on dashboard | Pending | |
| EMP-ONB-09 | Free employer finished onboarding | Open `/employer/candidates` or `/employer/messages` | Redirect to `/employer/dashboard` | Pending | |
| EMP-ONB-10 | Trial/paid employer finished onboarding | Open `/employer/candidates` or `/employer/messages` | Access allowed | Pending | |
| EMP-ONB-11 | Employer profile already has `company_name` | Open onboarding step 0 | Company Name input is pre-populated | Pending | |
| EMP-ONB-12 | Employer starts typing before profile finishes loading | Wait for profile load | Typed value is not overwritten by late prefill | Pending | |
| EMP-ONB-13 | Employer profile has blank `company_name` | Open onboarding step 0 | Input remains empty and editable | Pending | |

### 6.2 Employer Profile And Settings

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| EMP-PROF-01 | Employer logged in | Open `/employer/profile` | Existing company fields load | Pending | |
| EMP-PROF-02 | Employer updates name/industry/size | Save changes | Data persists after reload | Pending | |
| EMP-PROF-03 | Employer uploads valid logo | Upload image | File stored and public URL saved on profile | Pending | |
| EMP-PROF-04 | Employer upload fails | Upload file during storage error | Error feedback shown; previous logo unchanged | Pending | |
| EMP-SET-01 | Employer opens settings page | Open `/employer/settings` | Company tab loads from `employer_profiles` | Pending | |
| EMP-SET-02 | Employer edits company/contact/visibility fields | Save changes | Persisted to `employer_profiles` | Pending | |
| EMP-SET-03 | Employer toggles show on platform/company page | Save changes | Boolean values persist | Pending | |
| EMP-SET-04 | Employer uploads logo from settings | Upload file | Avatar updates and profile row stores URL | Pending | |
| EMP-SET-05 | Click cancel on settings company tab | Do not save | No persistence change should occur | Pending | |
| EMP-SET-06 | Static tabs present but not wired | Visit team/notifications/security UI | UI renders without crash; no unintended backend mutation | Pending | |

### 6.2A Employer Public Profile

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| EMP-PUB-01 | Employer public profile enabled | Open `/companies/:employerId` | Public company page loads with company identity data | Pending | |
| EMP-PUB-02 | Employer has logo and banner | Open public page | Logo and banner render correctly | Pending | |
| EMP-PUB-03 | Employer has public page disabled | Open public page directly | Page is hidden, blocked, or falls back according to product rule | Pending | |
| EMP-PUB-04 | Employer has branded fields | Open public page | Headline/colors/domain fields render safely without layout break | Pending | |
| EMP-PUB-05 | Unknown employer id | Open public page | Not-found or empty-state behavior is handled without crash | Pending | |

### 6.3 Employer Jobs

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| EMP-JOB-01 | Employer has jobs in all states | Open jobs page | Active/draft/closed counts are correct | Pending | |
| EMP-JOB-02 | No jobs match filters | Apply narrow filters | Empty state shown | Pending | |
| EMP-JOB-03 | Search by title/description/location/type | Enter query | Matching list updates correctly | Pending | |
| EMP-JOB-04 | Filter by employment type | Select type | Only jobs of that type remain | Pending | |
| EMP-JOB-05 | Filter by location | Select location | Only jobs in that location remain | Pending | |
| EMP-JOB-06 | Click reset | Reset filters | Filters and search clear | Pending | |
| EMP-JOB-07 | Create valid job under limit | Submit post-job modal | Job created, visible in active jobs | Pending | |
| EMP-JOB-08 | Free employer at active-job limit | Create or publish additional open job | Backend returns plan-limit error and upsell is shown | Pending | |
| EMP-JOB-09 | Edit existing job | Save changes | Changes persist | Pending | |
| EMP-JOB-10 | Close open job | Confirm close | Job moves to Closed tab | Pending | |
| EMP-JOB-11 | Publish archived job within limit | Click Publish | Job moves to Active tab | Pending | |
| EMP-JOB-12 | Publish archived job over limit | Click Publish | Plan-limit error and upsell shown | Pending | |
| EMP-JOB-13 | Closed job with renew action | Click Renew 30 Days | Status becomes open and visibility dates refresh | Pending | |
| EMP-JOB-14 | Open job with extend action | Click Extend 30 Days | Expiry extends by 30 days | Pending | |
| EMP-JOB-15 | Job nearing expiry | Open jobs page | Expiry warning badge shown | Pending | |
| EMP-JOB-16 | Featured job credit available | Click Feature Job | Credit consumed and featured badge shown | Pending | |
| EMP-JOB-17 | No featured job credit | Click Feature Job | Upsell modal opens | Pending | |
| EMP-JOB-18 | AI credit available | Click AI Match | Auto-match succeeds and success feedback shows count | Pending | |
| EMP-JOB-19 | No AI credit | Click AI Match | Upsell modal opens | Pending | |
| EMP-JOB-20 | AI report credit available | Click AI Report | Report modal opens with generated JSON | Pending | |
| EMP-JOB-21 | No AI report credit | Click AI Report | Upsell modal opens | Pending | |
| EMP-JOB-22 | Loading state in action | Run any job action | Correct button shows in-progress text and prevents duplicate submit | Pending | |

### 6.4 Employer Candidates

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| EMP-CAND-01 | Paid/trial employer | Open candidates page | Talent pool loads | Pending | |
| EMP-CAND-02 | Free employer | Open candidates page | Redirect to employer dashboard | Pending | |
| EMP-CAND-03 | Search by name/headline/location/skill | Enter query | Candidate list filters correctly | Pending | |
| EMP-CAND-04 | Filter by location | Select location | Only matching candidates remain | Pending | |
| EMP-CAND-05 | Filter by experience band | Select junior/mid/senior | Only matching candidates remain | Pending | |
| EMP-CAND-06 | Filter by exact skill | Select skill | Only candidates with that skill remain | Pending | |
| EMP-CAND-07 | No result combination | Apply tight filters | Empty state shown | Pending | |
| EMP-CAND-08 | Employer clicks Message Candidate | Click CTA | Navigate to employer messages with candidate query param | Pending | |

### 6.5 Employer Billing And Subscription UI

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| EMP-BILL-01 | Employer opens billing | Load page | Current plan card, usage, summary, payment source, invoices render | Pending | |
| EMP-BILL-02 | Free employer | Open billing | Current plan shows free entitlements and limits | Pending | |
| EMP-BILL-03 | Paid employer | Open billing | Current plan shows paid entitlements and usage | Pending | |
| EMP-BILL-04 | Employer with `pending_payment` and `selected_plan` | Open billing | Amber payment-required banner is shown | Pending | |
| EMP-BILL-05 | Upgrade CTA available | Click header/card/sidebar upgrade button | Checkout flow starts for next plan | Pending | |
| EMP-BILL-06 | Checkout success callback URL present | Load `/employer/billing?success=true&reference=...` | Confirmation runs, feedback shown, URL cleaned | Pending | |
| EMP-BILL-07 | Checkout confirmation fails after payment | Open callback URL | Pending-update feedback shown | Pending | |
| EMP-BILL-08 | Employer at 80%+ job usage | Open billing | Usage alert card shown | Pending | |
| EMP-BILL-09 | Employer over job limit | Open billing | Alert text shows over-limit message and upgrade/manage actions | Pending | |
| EMP-BILL-10 | Employer clicks cancel subscription | Confirm cancel | Subscription downgraded to free and feedback shown | Pending | |
| EMP-BILL-11 | Cancel subscription fails | Confirm cancel during backend error | Failure feedback shown and plan unchanged | Pending | |
| EMP-BILL-12 | Invoices exist | Open billing | Invoice rows show number, date, kind, total, status | Pending | |
| EMP-BILL-13 | Invoice downloadable | Click download | Signed URL returned and opened | Pending | |
| EMP-BILL-14 | Invoice not downloadable | Click disabled download | No action occurs | Pending | |
| EMP-BILL-15 | Invoice download failure | Trigger backend error | Failure feedback shown | Pending | |

### 6.6 Employer Add-ons

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| EMP-ADD-01 | Employer opens add-ons page | Load page | Add-on store and current balances render | Pending | |
| EMP-ADD-02 | No prior credits | Open page | Empty balance state shown | Pending | |
| EMP-ADD-03 | Add-on list populated | Open page | Correct type labels, credit counts, and prices show | Pending | |
| EMP-ADD-04 | Click Buy for add-on | Start checkout | Redirect begins | Pending | |
| EMP-ADD-05 | Add-on callback success | Load `/employer/addons?addon_success=true&reference=...` | Credits confirmed, balances refreshed, success feedback shown | Pending | |
| EMP-ADD-06 | Feature-job add-on callback | Confirm purchase | Messaging explicitly instructs user to feature job from jobs page | Pending | |
| EMP-ADD-07 | Job-slot add-on callback | Confirm purchase | Messaging confirms more open jobs available | Pending | |
| EMP-ADD-08 | Callback confirm fails | Load callback with backend error | Pending-update feedback shown | Pending | |

### 6.7 Employer Team Collaboration

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| EMP-TEAM-01 | Employer owner/admin on eligible plan | Open settings/team collaboration area | Existing team members load | Pending | |
| EMP-TEAM-02 | Employer recruiter role | Attempt to access management-only team actions | Restricted actions are hidden or blocked | Pending | |
| EMP-TEAM-03 | Owner/admin invites valid email as recruiter | Submit invite | Invite row is created with `invited` status | Pending | |
| EMP-TEAM-04 | Owner/admin invites valid email as admin | Submit invite | Invite row is created with `invited` status and admin role | Pending | |
| EMP-TEAM-05 | Invite duplicate active member | Re-invite same email | Duplicate invite is blocked or safely deduplicated | Pending | |
| EMP-TEAM-06 | Plan team-member limit reached | Invite additional member | Backend returns `TEAM_MEMBER_LIMIT_REACHED` and UI shows limit feedback | Pending | |
| EMP-TEAM-07 | Invited user signs up with matching email | Complete auth flow | User is attached to shared employer workspace | Pending | |
| EMP-TEAM-08 | Existing user with invite signs in | Complete auth flow | Invite is claimed and membership becomes active | Pending | |
| EMP-TEAM-09 | Owner/admin revokes member | Remove/revoke team member | Membership status changes and access is revoked | Pending | |
| EMP-TEAM-10 | Current user is only owner | Attempt destructive owner-removal flow | Guard rails prevent locking workspace with no owner | Pending | |

## 7. Messaging

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| MSG-01 | Candidate or paid employer signed in | Open messages page | Conversation layout loads | Pending | |
| MSG-02 | User not signed in | Open messages page | "Messaging is only available" state shown | Pending | |
| MSG-03 | Employer with candidate query param | Open `/employer/messages?candidate=<id>` | Conversation is created or reused and opened | Pending | |
| MSG-04 | Employer with no existing threads | Open messages | Empty-state start-chat UI shown | Pending | |
| MSG-05 | Candidate with no threads | Open messages | Candidate sees no-conversation message | Pending | |
| MSG-06 | Employer starts chat from recipient dropdown | Select candidate and click Start Chat | Conversation opens and thread list refreshes | Pending | |
| MSG-07 | Active conversation selected | Load thread | Messages load and conversation is marked read | Pending | |
| MSG-08 | Send valid message | Type and send | Message persists, appears in thread, draft clears | Pending | |
| MSG-09 | Press Enter without Shift | Compose message and press Enter | Message sends | Pending | |
| MSG-10 | Press Shift+Enter | Compose message and press Shift+Enter | New line added, message not auto-sent | Pending | |
| MSG-11 | Incoming realtime message | Send from second client | Message appears without manual refresh | Pending | |
| MSG-12 | Realtime conversation update | New thread/message arrives | Thread list refreshes and ordering updates | Pending | |
| MSG-13 | Search thread list | Enter search text | Threads filter by counterpart metadata and preview | Pending | |
| MSG-14 | Send failure | Simulate backend failure | Feedback dialog shows error and draft handling is safe | Pending | |

## 8. Applications, Matching, And Candidate Deep View

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| APP-01 | Candidate applies to job | Submit application | `calculate_skill_match` is called and score saved on application | Pending | |
| APP-02 | Application created | Observe notification flow | Application email function is triggered; app does not fail if email dispatch fails | Pending | |
| APP-03 | Employer views applicants for a job | Open candidates modal for job | Applications ordered by score descending, then newest | Pending | |
| APP-04 | Employer updates application to shortlisted | Change status | Status persists and shortlisted email is triggered | Pending | |
| APP-05 | Shortlisted notification email fails | Update status to shortlisted during email issue | Error is surfaced so operator knows notification failed | Pending | |
| APP-06 | Employer updates status to interview/rejected/hired | Change status | Status persists without shortlisted-email trigger | Pending | |
| APP-07 | Employer with AI credit accesses deep candidate view flow | Open candidate deep view path | Paid matching/report enrichment can proceed | Pending | |
| APP-08 | Employer without AI credit accesses deep view | Open candidate deep view path | Paid AI path is blocked/falls back as designed; no unauthorized credit-free premium usage | Pending | |
| APP-09 | Starter plan candidate deep view | Open profile drawer | Score block hidden with upsell when no AI credit | Pending | |
| APP-10 | Professional plan candidate deep view | Open profile drawer | Overall score visible, breakdown hidden | Pending | |
| APP-11 | Enterprise plan candidate deep view | Open profile drawer | Score and breakdown visible | Pending | |

## 9. Subscription Plans, Limits, Credits, And Gating

### 9.1 Plan Matrix Validation

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| PLN-01 | Free plan employer | Load usage snapshot | Job limit resolves to 1, candidate-view limit resolves to 10 | Pending | |
| PLN-02 | Starter employer | Load usage snapshot | Plan limit matches seeded plan row or fallback values | Pending | |
| PLN-03 | Professional employer | Load usage snapshot | Plan limit matches seeded plan row or fallback values | Pending | |
| PLN-04 | Enterprise employer | Load usage snapshot | Job/user/view limits resolve to unlimited or configured high values | Pending | |
| PLN-05 | Active trial employer | Evaluate access helpers | `isActiveEmployerTrial` true and paid access granted | Pending | |
| PLN-06 | Paid active employer | Evaluate access helpers | `hasEmployerPaidAccess` true | Pending | |
| PLN-07 | Paid plan with inactive/cancelled status | Evaluate access helpers | Paid access false | Pending | |

### 9.2 Job Limit Enforcement

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| PLN-JOB-01 | Free employer with 0 open jobs | Create job | Success | Pending | |
| PLN-JOB-02 | Free employer with 1 open job | Create second open job | Backend rejects with `PLAN_LIMIT_REACHED` | Pending | |
| PLN-JOB-03 | Free employer with archived job only | Publish archived job | Success if resulting open count within limit | Pending | |
| PLN-JOB-04 | Employer at limit closes a job | Close current open job then publish another | Publish now succeeds | Pending | |
| PLN-JOB-05 | Employer buys job-slot add-on | Publish beyond normal plan limit | Action succeeds per consumed credit/business rule | Pending | |

### 9.3 Candidate View Limits And Credits

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| PLN-VIEW-01 | Employer under monthly candidate-view limit | Open authorized candidate profile | View succeeds and usage increments | Pending | |
| PLN-VIEW-02 | Employer reopens same already-authorized candidate view | Open again | No duplicate monthly usage increment if uniqueness rules apply | Pending | |
| PLN-VIEW-03 | Employer at limit with no credit | Open new candidate profile | Access denied with limit/credit message | Pending | |
| PLN-VIEW-04 | Employer with purchased candidate-view credit | Open new candidate profile after limit reached | Access succeeds and credit is consumed | Pending | |

### 9.4 AI Credits And Premium Actions

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| PLN-AI-01 | Employer has AI credit | Run auto-match | One credit consumed if business rule requires | Pending | |
| PLN-AI-02 | Employer has AI credit | Generate AI report | One credit consumed if business rule requires | Pending | |
| PLN-AI-03 | Employer has zero AI credit | Run AI action | Backend blocks with insufficient-credit error | Pending | |
| PLN-AI-04 | Employer has featured-job credit | Feature job | Featured credit balance decreases | Pending | |
| PLN-AI-05 | Employer has zero featured-job credit | Feature job | Backend blocks with insufficient-credit error | Pending | |

## 10. Backend / Edge Functions

| ID | Function / Area | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| BE-01 | `analyze-candidate-profile` | Invoke for candidate owner with CV/profile data | Resume text/summary/analysis fields updated and skills normalized | Pending | |
| BE-02 | `analyze-candidate-profile` | Invoke by non-owner or wrong role | Request denied | Pending | |
| BE-03 | `generate-embedding` | Invoke for candidate profile | Candidate embedding refreshed | Pending | |
| BE-04 | `generate-job-embedding` | Create job and observe background call | Job embedding function invoked with `skip_credit=true` | Pending | |
| BE-05 | `auto-match` | Invoke with valid employer session and job id | Matches are computed and persisted to `job_matches` | Pending | |
| BE-06 | `auto-match` | Invoke with invalid JWT | Function returns auth error | Pending | |
| BE-07 | `generate-ai-report` | Invoke with valid paid/credited employer | Report payload returned and saved if applicable | Pending | |
| BE-08 | `feature-job` | Invoke with valid credit and job id | Job becomes featured with valid end date | Pending | |
| BE-09 | `consume-credit` | Invoke with sufficient balance | Balance decreases and usage row recorded | Pending | |
| BE-10 | `consume-credit` | Invoke with insufficient balance | Function fails cleanly without partial decrement | Pending | |
| BE-11 | `authorize-candidate-view` | Invoke within limit | Authorization succeeds and usage recorded | Pending | |
| BE-12 | `authorize-candidate-view` | Invoke over limit without credit | Authorization rejected | Pending | |
| BE-13 | `initialize-subscription` | Start checkout for paid plan | Paystack authorization URL returned | Pending | |
| BE-14 | `confirm-subscription` | Confirm successful payment reference | Employer plan/status/invoice updated idempotently | Pending | |
| BE-15 | `confirm-subscription` | Confirm same reference twice | No duplicate subscription activation or invoice duplication | Pending | |
| BE-16 | `cancel-subscription` | Cancel active subscription | Employer downgraded to free or cancellation state handled correctly | Pending | |
| BE-17 | `buy-addon` | Start add-on checkout | Paystack authorization URL returned | Pending | |
| BE-18 | `confirm-addon` | Confirm same add-on reference twice | Credits added once only | Pending | |
| BE-19 | `paystack-webhook` | Send valid subscription payment event | Event reconciles checkout state idempotently | Pending | |
| BE-20 | `paystack-webhook` | Send add-on payment event | Credits/invoice updated correctly | Pending | |
| BE-21 | `paystack-webhook` | Send invalid signature | Webhook rejected | Pending | |
| BE-22 | `get-invoice-download-url` | Request own invoice | Signed/public URL returned | Pending | |
| BE-23 | `get-invoice-download-url` | Request other employer invoice | Access denied | Pending | |
| BE-24 | `send-notification-email` | Trigger application-created payload | Email request accepted with correct template context | Pending | |
| BE-25 | `send-notification-email` | Trigger shortlisted payload | Email request accepted with correct template context | Pending | |

## 11. Database, RLS, And Data Integrity

| ID | Area | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| DB-01 | `profiles` role isolation | Candidate tries to read/update employer profile row | RLS denies access | Pending | |
| DB-02 | `candidate_profiles` ownership | Candidate tries to update another candidate profile | RLS denies access | Pending | |
| DB-03 | `employer_profiles` ownership | Employer tries to update another employer profile | RLS denies access | Pending | |
| DB-04 | `jobs` ownership | Employer tries to update another employer's job | Update denied | Pending | |
| DB-05 | `job_applications` privacy | Candidate cannot view unrelated applications | Access denied | Pending | |
| DB-06 | `messages` privacy | User cannot read messages from unrelated conversation | Access denied | Pending | |
| DB-07 | `billing_invoices` privacy | Employer cannot read another employer's invoice list | Access denied | Pending | |
| DB-08 | `employer_credits` integrity | Concurrent credit consumption requests | Balance never drops below valid expected value | Pending | |
| DB-09 | Subscription reconciliation | Repeat webhook/confirm calls | No duplicate invoices, purchases, or credits | Pending | |
| DB-10 | Candidate view uniqueness | Repeated view for same context in same constrained window | Usage uniqueness rules hold | Pending | |

## 12. Notifications And Emails

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| NOTIF-01 | Candidate applies to job | Complete application | Employer-facing notification flow triggers | Pending | |
| NOTIF-02 | Employer shortlists candidate | Update status | Candidate-facing shortlisted email triggers | Pending | |
| NOTIF-03 | Email provider temporary failure | Trigger email event | Core business transaction remains consistent; failure logged/surfaced | Pending | |

## 12A. Recent Regression Suite

Run this focused suite after every candidate/employer UI change:

| ID | Area | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| REG-01 | Candidate availability | Open candidate profile availability dropdown | Latest options render exactly as configured | Pending | |
| REG-02 | Candidate availability persistence | Change availability, save, reload | Selected value remains unchanged | Pending | |
| REG-03 | Candidate profile save | Save availability plus another profile field | Both values persist together | Pending | |
| REG-04 | Employer onboarding prefill | Open onboarding with stored company name | Company name is auto-populated | Pending | |
| REG-05 | Employer onboarding manual override | Replace prefilled company name and continue | Manual edit is persisted, not the original default | Pending | |
| REG-06 | Employer onboarding blank state | New employer with no profile name opens onboarding | Company name remains blank and required | Pending | |
| REG-07 | Plan gate routing | Free employer tries candidates/messages; paid employer tries same | Free is redirected, paid is allowed | Pending | |
| REG-08 | Billing/add-on callbacks | Open billing and add-on success callback URLs | Confirmation flow still succeeds after UI updates | Pending | |

## 13. Error Handling And Recovery

| ID | Preconditions | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|---|
| ERR-01 | Network interrupted during page load | Open any major page | Loading stops gracefully and console/back-end errors do not crash UI | Pending | |
| ERR-02 | Network interrupted during job apply | Apply for job | Error feedback shown; button resets | Pending | |
| ERR-03 | Network interrupted during checkout start | Start subscription/add-on checkout | Error feedback shown; no false success | Pending | |
| ERR-04 | Session expires during authed function call | Run billing/add-on/AI action | Session refresh attempted automatically, then action proceeds or explicit sign-in error shown | Pending | |
| ERR-05 | Realtime subscription disconnects | Messaging open during socket drop | Existing messages remain; reconnect should restore updates when available | Pending | |

## 14. Accessibility, Responsive, And UX Regression

| ID | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|
| A11Y-01 | Navigate candidate jobs page with keyboard only | Search, filters, save, details, and apply are operable | Pending | |
| A11Y-02 | Navigate dialogs/modals with keyboard | Focus trap, ESC/close behavior, and return focus are correct | Pending | |
| A11Y-03 | Validate visible labels for forms | Inputs and controls have readable labels | Pending | |
| A11Y-04 | Check color-contrast critical elements | Primary buttons, badges, and alerts remain readable | Pending | |
| RWD-01 | Test mobile viewport on candidate jobs | Filters move into sheet, actions remain usable | Pending | |
| RWD-02 | Test mobile viewport on employer billing | Cards stack correctly; primary billing actions remain visible | Pending | |
| RWD-03 | Test tablet viewport on jobs/messages | Layout adapts without clipped content | Pending | |

## 15. Performance And Operational Checks

| ID | Steps | Expected Result | Status | Comments / Test Results |
|---|---|---|---|---|
| PERF-01 | Load candidate jobs with 100+ jobs | Page remains responsive and first render is acceptable | Pending | |
| PERF-02 | Load employer jobs with many applications | Counts and filters remain responsive | Pending | |
| PERF-03 | Load messages thread with long history | Scrolling and send interaction remain acceptable | Pending | |
| PERF-04 | Run available load scripts in `load-tests/` against safe environment | No critical failures, acceptable response profile | Pending | |

## 16. Release Exit Criteria

Release should be blocked if any of the following fail:

- Authentication or role routing smoke tests
- Candidate apply flow
- Employer job creation/edit/close flow
- Billing checkout confirmation or webhook idempotency
- Add-on purchase confirmation and credit reconciliation
- Messaging send/receive flow
- Plan-limit enforcement on backend
- RLS/privacy checks for profiles, jobs, messages, invoices, and credits

## 17. Suggested Execution Order

1. Smoke suite
2. Auth and routing
3. Candidate flows
4. Employer flows
5. Billing, plans, and add-ons
6. Messaging and notifications
7. Edge functions and webhook idempotency
8. RLS/security
9. Accessibility and responsive checks
10. Performance/load checks


