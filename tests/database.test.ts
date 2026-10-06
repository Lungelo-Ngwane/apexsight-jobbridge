// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { createTestDatabase } from './database';
let db: PGlite;
const candidate = '00000000-0000-4000-8000-000000000001';
const otherCandidate = '00000000-0000-4000-8000-000000000002';
const employer = '00000000-0000-4000-8000-000000000003';
const otherEmployer = '00000000-0000-4000-8000-000000000004';
let profileId: string, workspaceId: string, jobId: string, applicationId: string, addonId: string;
async function actor(role: string, user = '') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)", [user, role]);
  await db.exec('set role ' + role);
}
async function scalar(sql: string, values: unknown[] = []) { return (await db.query<Record<string, unknown>>(sql, values)).rows[0]; }
beforeAll(async () => {
  db = await createTestDatabase();
  await db.query('insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12)',
    [candidate, 'candidate@example.invalid', {role:'candidate',full_name:'Fictional Candidate'}, otherCandidate, 'other@example.invalid', {role:'candidate',full_name:'Other Fictional Candidate'}, employer, 'employer@example.invalid', {role:'employer', company_name:'Fictional Employer'}, otherEmployer, 'workspace@example.invalid', {role:'employer', company_name:'Other Fictional Employer'}]);
  profileId = String((await scalar('select id from public.candidate_profiles where user_id=$1', [candidate]))!.id);
  workspaceId = String((await scalar('select id from public.employer_profiles where user_id=$1', [employer]))!.id);
  await db.query("update public.candidate_profiles set cv_url=$2 where id=$1", [profileId, candidate+'/resume.pdf']);
  const skill = String((await scalar("insert into public.skills(name, category) values('Fictional Skill', 'Other') returning id"))!.id);
  await db.query("insert into public.candidate_skills(candidate_profile_id,skill_id,skill,level) values($1,$2,'Fictional Skill','advanced')", [profileId,skill]);
  jobId = String((await scalar("insert into public.jobs(employer_id,title,description,experience_level) values($1,'Fictional job','Fictional job description','junior') returning id", [workspaceId]))!.id);
  addonId = String((await scalar("insert into public.addons(name,price,type,credits) values('Fictional credits',1000,'ai_credit',2) returning id"))!.id);
}, 60000);
afterAll(async () => { await db?.close(); });
describe('database authorization and billing', () => {
  it('repairs only the authenticated candidate own missing profile and is idempotent', async () => {
    await db.exec('reset role');
    const id = '00000000-0000-4000-8000-000000000006';
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id,'repair@example.invalid',{role:'candidate',full_name:'Fictional repair'}]);
    await db.query('delete from public.candidate_profiles where user_id=$1',[id]);
    await actor('authenticated',id);
    const first=await scalar('select public.ensure_candidate_profile() as id');
    expect(await scalar('select public.ensure_candidate_profile() as id')).toEqual(first);
    await actor('authenticated',employer);
    await expect(db.exec('select public.ensure_candidate_profile()')).rejects.toThrow(/Candidate account required/);
  });
  it('rejects anonymous access to private records and payment mutation RPCs', async () => {
    await actor('anon');
    await expect(db.exec('select * from public.candidate_profiles')).rejects.toThrow(/permission denied/);
    await expect(db.query("select public.grant_addon_credits('fictional', $1,$2,1,'ai_credit',100)", [workspaceId,addonId])).rejects.toThrow(/permission denied/);
    expect((await db.exec('select title from public.jobs'))[0].rows).toHaveLength(1);
  });
  it('isolates candidates and keeps account roles immutable', async () => {
    await actor('authenticated', candidate);
    expect((await db.exec('select user_id from public.candidate_profiles'))[0].rows).toEqual([{user_id:candidate}]);
    await expect(db.query("update public.profiles set role='employer' where id=$1",[candidate])).rejects.toThrow(/trusted server/);
    await expect(db.query("insert into public.employer_profiles(user_id,company_name) values($1,'Forged')",[candidate])).rejects.toThrow(/permission denied/);
    await db.query("update public.candidate_profiles set headline='Updated headline' where id=$1",[profileId]);
  });
  it('does not promote a signup metadata role to platform administrator', async () => {
    await actor('service_role');
    await db.exec('reset role');
    const id='00000000-0000-4000-8000-000000000005';
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,'requested-admin@example.invalid',{role:'admin'}]);
    expect((await scalar('select role from public.profiles where id=$1',[id]))!.role).toBeNull();
    expect((await db.exec('select * from public.admin_users'))[0].rows).toHaveLength(0);
  });
  it('blocks a workspace from granting itself a paid subscription', async () => {
    await actor('authenticated',employer);
    await expect(db.query("update public.employer_profiles set plan='enterprise',subscription_status='active' where id=$1",[workspaceId])).rejects.toThrow(/trusted server/);
    await expect(db.query("update public.employer_credits set remaining=1000 where employer_id=$1",[workspaceId])).rejects.toThrow(/permission denied/);
    await expect(db.exec('delete from public.employer_credit_usage')).rejects.toThrow(/permission denied/);
    expect((await db.exec('select id from public.employer_profiles'))[0].rows).toEqual([{id:workspaceId}]);
    await db.query("update public.employer_profiles set company_name='Updated Fictional Employer' where id=$1",[workspaceId]);
  });
  it('checks application readiness and computes status/scores on the server', async () => {
    await actor('authenticated',otherCandidate);
    const otherProfile=String((await scalar('select id from public.candidate_profiles where user_id=$1',[otherCandidate]))!.id);
    await expect(db.query('insert into public.job_applications(job_id,candidate_profile_id) values($1,$2)',[jobId,otherProfile])).rejects.toThrow(/requirements/);
    await actor('authenticated',candidate);
    applicationId=String((await scalar("insert into public.job_applications(job_id,candidate_profile_id,status,score) values($1,$2,'hired',100) returning id,status,score",[jobId,profileId]))!.id);
    expect((await scalar('select status from public.job_applications where id=$1',[applicationId]))!.status).toBe('applied');
    await expect(db.query('insert into public.job_applications(job_id,candidate_profile_id) values($1,$2)',[jobId,otherProfile])).rejects.toThrow();
  });
  it('exposes a safe applicant summary while keeping private resume evidence locked', async () => {
    await actor('authenticated',employer);
    expect((await db.exec('select resume_text from public.candidate_profiles'))[0].rows).toHaveLength(0);
    const result=await scalar('select public.get_candidate_summaries($1::uuid[]) as summaries',[[profileId]]);
    const summary=(result!.summaries as Array<Record<string, unknown>>)[0];
    expect(summary.full_name).toBe('Fictional Candidate'); expect(summary).not.toHaveProperty('cv_url'); expect(summary).not.toHaveProperty('resume_text');
  });
  it('deducts one unlock credit for repeated access and then permits private reads', async () => {
    await actor('service_role');
    await db.query("insert into public.employer_credits(employer_id,credit_type,remaining) values($1,'candidate_unlock',1)",[workspaceId]);
    const first=await scalar('select public.unlock_candidate($1,$2) as result',[workspaceId,applicationId]);
    const second=await scalar('select public.unlock_candidate($1,$2) as result',[workspaceId,applicationId]);
    expect((first!.result as Record<string,unknown>).source).toBe('addon');
    expect((second!.result as Record<string,unknown>).source).toBe('existing');
    expect((await scalar("select remaining from public.employer_credits where employer_id=$1 and credit_type='candidate_unlock'",[workspaceId]))!.remaining).toBe(0);
    await actor('authenticated',employer);
    expect((await db.exec('select id from public.candidate_profiles'))[0].rows).toEqual([{id:profileId}]);
    await actor('authenticated',otherEmployer);
    expect((await db.exec('select id from public.candidate_profiles'))[0].rows).toHaveLength(0);
  });
  it('fulfills one immutable payment intent once and rejects an amount/currency mismatch', async () => {
    await actor('service_role');
    await db.query("insert into public.checkout_intents(reference,employer_id,kind,amount_minor,addon_id,credit_type,credits) values('fixture_payment',$1,'addon',1000,$2,'ai_credit',2)",[workspaceId,addonId]);
    await expect(db.exec("select public.fulfill_checkout('fixture_payment',1,'ZAR')")).rejects.toThrow(/Invalid payment intent/);
    await expect(db.exec("select public.fulfill_checkout('fixture_payment',1000,'USD')")).rejects.toThrow(/Invalid payment intent/);
    await db.exec("select public.fulfill_checkout('fixture_payment',1000,'ZAR')");
    const replay=await scalar("select public.fulfill_checkout('fixture_payment',1000,'ZAR') as result");
    expect((replay!.result as Record<string,unknown>).alreadyProcessed).toBe(true);
    expect((await scalar("select remaining from public.employer_credits where employer_id=$1 and credit_type='ai_credit'",[workspaceId]))!.remaining).toBe(2);
  });
  it('atomically consumes available credits and refuses overspending or negative amounts', async () => {
    await actor('service_role');
    await expect(db.query("select public.consume_employer_credit($1,'ai_credit',-1)",[workspaceId])).rejects.toThrow(/Invalid amount/);
    const results=await Promise.allSettled([db.query("select public.consume_employer_credit($1,'ai_credit',2)",[workspaceId]),db.query("select public.consume_employer_credit($1,'ai_credit',2)",[workspaceId])]);
    expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    expect((await scalar("select remaining from public.employer_credits where employer_id=$1 and credit_type='ai_credit'",[workspaceId]))!.remaining).toBe(0);
  });
  it('leases event processing and refuses a second simultaneous claim', async () => {
    await actor('service_role');
    const a=await scalar("select public.claim_payment_event('fixture_event','charge.success','fixture_payment','{}') as token");
    const b=await scalar("select public.claim_payment_event('fixture_event','charge.success','fixture_payment','{}') as token");
    expect(a!.token).toBeTruthy(); expect(b!.token).toBeNull();
    await db.exec("update public.payment_webhook_events set processing_until=now()-interval '1 second' where event_key='fixture_event'");
    expect((await scalar("select public.claim_payment_event('fixture_event','charge.success','fixture_payment','{}') as token"))!.token).toBeTruthy();
  });
});
