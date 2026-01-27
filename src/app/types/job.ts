export interface Job {
  id: string;
  title: string;
  description: string;
  location: string | null;
  employment_type: string | null;
  created_at: string;
  employer: {
    company_name: string;
  };
}
