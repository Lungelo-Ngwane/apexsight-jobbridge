insert into storage.buckets (id, name, public)
values ('resume', 'resume', false)
on conflict (id) do nothing;

drop policy if exists "resume_files_select_own" on storage.objects;
create policy "resume_files_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resume'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "resume_files_insert_own" on storage.objects;
create policy "resume_files_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'resume'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "resume_files_update_own" on storage.objects;
create policy "resume_files_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'resume'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'resume'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "resume_files_delete_own" on storage.objects;
create policy "resume_files_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'resume'
  and (storage.foldername(name))[1] = auth.uid()::text
);
