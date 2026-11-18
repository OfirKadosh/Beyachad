begin;

alter table public.documents
  drop constraint documents_size_bytes_check,
  add constraint documents_size_bytes_check
    check (size_bytes between 1 and 10485760);

update storage.buckets
set file_size_limit = 10485760
where id = 'wedding-documents';

commit;
