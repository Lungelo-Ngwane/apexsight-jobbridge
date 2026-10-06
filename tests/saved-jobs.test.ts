import { beforeEach,expect,it,vi } from 'vitest';
import { getCandidateSavedJobIds,toggleCandidateSavedJob } from '../src/lib/candidate/saved-jobs';
const session = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase',() => ({supabase:{auth:{getSession:session}}}));
beforeEach(()=>{localStorage.clear();session.mockReset();session.mockResolvedValue({data:{session:{user:{id:'first'}}}});});
it('isolates saved jobs by account and toggles them without duplicate entries',async()=>{
  expect(await toggleCandidateSavedJob('job')).toEqual(['job']);expect(await toggleCandidateSavedJob('job')).toEqual([]);
  await toggleCandidateSavedJob('first-job');session.mockResolvedValue({data:{session:{user:{id:'second'}}}});
  expect(await getCandidateSavedJobIds()).toEqual([]);expect(await toggleCandidateSavedJob('second-job')).toEqual(['second-job']);
  expect(JSON.parse(localStorage.getItem('candidate_saved_jobs_first')!)).toEqual(['first-job']);
});
it('recovers from malformed local data and ignores non-string IDs',async()=>{
  localStorage.setItem('candidate_saved_jobs_first','invalid');expect(await getCandidateSavedJobIds()).toEqual([]);
  localStorage.setItem('candidate_saved_jobs_first','["job", "job", null, {}]');expect(await getCandidateSavedJobIds()).toEqual(['job']);
});
