import { supabase } from './supabase';
export interface PublicEmployer {
  id: string; company_name: string; industry: string | null; logo_url: string | null; plan: string;
  brand_primary_color: string | null; custom_domain: string | null; careers_page_headline: string | null;
  public_company_page: boolean; description: string | null; website: string | null; banner_image_url: string | null;
  company_size: string | null; show_on_platform: boolean;
  address?: null; enterprise_account_manager_name?: null; enterprise_account_manager_email?: null;
  sla_tier?: null; sla_uptime_target?: null; sla_response_time_hours?: null;
}
export interface CandidateSummary {
  id: string; full_name: string; headline: string | null; location: string | null; bio: string | null;
  preferred_job_type: string | null; years_experience: number | null;
  candidate_skills: Array<{ skill_id: string; skill: string; level: string | null; skills: { name: string } }>;
}
export async function getPublicEmployers(ids: string[]): Promise<PublicEmployer[]> {
  const rows: PublicEmployer[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await supabase.rpc('get_public_employers', { p_ids: ids.slice(offset, offset + 100) });
    if (error) throw error; rows.push(...(data ?? []) as PublicEmployer[]);
  }
  return rows;
}
export async function getCandidateSummaries(ids: string[]): Promise<Map<string, CandidateSummary>> {
  const rows: CandidateSummary[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await supabase.rpc('get_candidate_summaries', { p_ids: ids.slice(offset, offset + 100) });
    if (error) throw error; rows.push(...(data ?? []) as CandidateSummary[]);
  }
  return new Map(rows.map(row => [row.id, row]));
}
