insert into storage.buckets (id, name, public)
values ('employer-logos', 'employer-logos', true)
on conflict (id) do nothing;

drop policy if exists "employer_logos_public_read" on storage.objects;
create policy "employer_logos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'employer-logos');

drop policy if exists "employer_logos_insert_own" on storage.objects;
create policy "employer_logos_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'employer-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "employer_logos_update_own" on storage.objects;
create policy "employer_logos_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'employer-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'employer-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "employer_logos_delete_own" on storage.objects;
create policy "employer_logos_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'employer-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
