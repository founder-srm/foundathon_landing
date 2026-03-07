insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'foundathon-payment-proofs',
  'foundathon-payment-proofs',
  false,
  5242880,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "payment proof owners can view" on storage.objects;
drop policy if exists "payment proof owners can upload" on storage.objects;
drop policy if exists "payment proof owners can update" on storage.objects;
drop policy if exists "payment proof owners can delete" on storage.objects;

create policy "payment proof owners can view"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'foundathon-payment-proofs'
  and (storage.foldername(name))[1] = 'payment-proofs'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "payment proof owners can upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'foundathon-payment-proofs'
  and (storage.foldername(name))[1] = 'payment-proofs'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "payment proof owners can update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'foundathon-payment-proofs'
  and (storage.foldername(name))[1] = 'payment-proofs'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'foundathon-payment-proofs'
  and (storage.foldername(name))[1] = 'payment-proofs'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "payment proof owners can delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'foundathon-payment-proofs'
  and (storage.foldername(name))[1] = 'payment-proofs'
  and (storage.foldername(name))[2] = auth.uid()::text
);
