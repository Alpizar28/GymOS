-- Create profile photos bucket and owner-only policies.
-- Run in Supabase SQL editor.

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create policy profile_photos_owner_select
on storage.objects
for select
using (bucket_id = 'profile-photos');

create policy profile_photos_owner_insert
on storage.objects
for insert
with check (
  bucket_id = 'profile-photos'
  and auth.uid()::text = (storage.foldername(name))[2]
);

create policy profile_photos_owner_update
on storage.objects
for update
using (
  bucket_id = 'profile-photos'
  and auth.uid()::text = (storage.foldername(name))[2]
)
with check (
  bucket_id = 'profile-photos'
  and auth.uid()::text = (storage.foldername(name))[2]
);

create policy profile_photos_owner_delete
on storage.objects
for delete
using (
  bucket_id = 'profile-photos'
  and auth.uid()::text = (storage.foldername(name))[2]
);
