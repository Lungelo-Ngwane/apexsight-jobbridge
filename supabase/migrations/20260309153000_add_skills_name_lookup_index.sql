-- Speed up case-insensitive skill resolution for user-entered skills.
create index if not exists skills_name_normalized_lookup_idx
  on public.skills (lower(btrim(name)));
