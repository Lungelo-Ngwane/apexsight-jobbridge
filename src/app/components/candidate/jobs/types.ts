export interface Job {
  id: string;
  employer_id: string;
  title: string;
  description: string;
  location: string | null;
  employment_type: string | null;
  is_featured?: boolean;
  featured_until?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  experience_level?: string | null;
  skills_required?: string[] | null;
  created_at: string;
  employer: {
    company_name: string;
    industry?: string | null;
    logo_url?: string | null;
    plan?: string | null;
    brand_primary_color?: string | null;
    custom_domain?: string | null;
    careers_page_headline?: string | null;
    public_company_page?: boolean;
  };
}

