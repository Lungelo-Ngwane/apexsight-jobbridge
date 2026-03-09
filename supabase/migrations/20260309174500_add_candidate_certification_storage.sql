alter table public.candidate_certifications
  add column if not exists certificate_file_path text;

insert into storage.buckets (id, name, public)
values ('candidate-certifications', 'candidate-certifications', false)
on conflict (id) do nothing;

drop policy if exists "candidate_certifications_files_select_own" on storage.objects;
create policy "candidate_certifications_files_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'candidate-certifications'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "candidate_certifications_files_insert_own" on storage.objects;
create policy "candidate_certifications_files_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'candidate-certifications'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "candidate_certifications_files_update_own" on storage.objects;
create policy "candidate_certifications_files_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'candidate-certifications'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'candidate-certifications'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "candidate_certifications_files_delete_own" on storage.objects;
create policy "candidate_certifications_files_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'candidate-certifications'
  and (storage.foldername(name))[1] = auth.uid()::text
);
