alter table if exists public.candidate_profiles
add column if not exists surname text,
add column if not exists date_of_birth date,
add column if not exists id_number text,
add column if not exists gender text,
add column if not exists contact_number text;
