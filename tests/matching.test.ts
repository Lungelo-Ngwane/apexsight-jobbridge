import { expect,it } from 'vitest';
import { computeMatchIntelligence } from '../src/lib/employer/matching';
it('does not invent a score when no scores are available',()=>{
  const result=computeMatchIntelligence({applicationScore:null,aiSimilarity:null,job:{},candidate:{}});
  expect(result.finalMatchScore).toBeNull();expect(result.confidenceScore).toBe(0);
});
it('explains required skill penalties and bounds displayed scores',()=>{
  const result=computeMatchIntelligence({applicationScore:10,aiSimilarity:10,scoreBreakdown:{required:0,experience:0},job:{experience_level:'senior',job_skills:[{required:true,skill_id:'required'}]},candidate:{candidate_skills:[]}});
  expect(result.penalty).toBe(30);expect(result.finalMatchScore).toBe(0);expect(result.knockoutFilters).toHaveLength(2);
});
