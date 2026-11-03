begin;
alter table public.weddings add column details_version integer not null default 1 check(details_version>0);
alter table public.wedding_members add column member_slot text;
update public.wedding_members set member_slot=case when role='owner' then 'one' else 'two' end;
alter table public.wedding_members alter column member_slot set not null;
alter table public.wedding_members alter column member_slot set default 'one';
alter table public.wedding_members add constraint member_slot_valid check(member_slot in ('one','two'));
alter table public.wedding_members add constraint wedding_slot_unique unique(wedding_id,member_slot);

create function public.save_wedding_details(p_wedding_id uuid,p_version integer,p_one text,p_two text,p_date date)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_member(p_wedding_id) then raise exception 'Forbidden'; end if;
 update public.weddings set partner_one=trim(coalesce(p_one,'')),partner_two=trim(coalesce(p_two,'')),wedding_date=p_date,details_version=details_version+1
 where id=p_wedding_id and details_version=p_version;
 if not found then raise exception 'Conflict' using errcode='40001'; end if;
end; $$;
revoke all on function public.save_wedding_details(uuid,integer,text,text,date) from public,anon;
grant execute on function public.save_wedding_details(uuid,integer,text,text,date) to authenticated;

-- Slot identity remains stable even when ownership passes to the remaining partner.
create or replace function public.accept_invite(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare w uuid; u uuid:=auth.uid(); h text; slot text;
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if exists(select 1 from public.wedding_members where user_id=u) then raise exception 'Already a member'; end if;
 h:=encode(extensions.digest(trim(p_token),'sha256'),'hex');
 select wedding_id into w from private.invites where token_hash=h and expires_at>now();
 if w is null then raise exception 'Invalid invitation'; end if;
 perform 1 from public.weddings where id=w for update;
 if not exists(select 1 from private.invites where token_hash=h and expires_at>now()) then raise exception 'Invitation consumed'; end if;
 if (select count(*) from public.wedding_members where wedding_id=w)>=2 then raise exception 'Wedding full'; end if;
 slot:=case when exists(select 1 from public.wedding_members where wedding_id=w and member_slot='one') then 'two' else 'one' end;
 insert into public.wedding_members(wedding_id,user_id,role,member_slot) values(w,u,'partner',slot);
 delete from private.invites where wedding_id=w;
 return w;
end; $$;

create table public.documents (
 id uuid primary key,
 wedding_id uuid not null references public.weddings(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 160),
 mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png')),
 size_bytes integer not null check(size_bytes between 1 and 5242880),
 vendor_id uuid references public.vendors(id) on delete set null,
 payment_id uuid references public.payments(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
create policy documents_read on public.documents for select to authenticated using(private.is_member(wedding_id));
revoke all on public.documents from public,anon,authenticated;
grant select on public.documents to authenticated;
-- Writes only from the authenticated document Edge Function, using its server key.
grant all on public.documents to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('wedding-documents','wedding-documents',false,5242880,array['application/pdf','image/jpeg','image/png']);
create policy document_download on storage.objects for select to authenticated using(
 bucket_id='wedding-documents' and exists(select 1 from public.documents d where storage.objects.name=d.wedding_id::text||'/'||d.id::text and private.is_member(d.wedding_id))
);
-- Intentionally no client insert/update/delete policy on storage.objects.
create function public.register_document(p_user_id uuid,p_id uuid,p_wedding_id uuid,p_name text,p_mime_type text,p_size integer,p_vendor_id uuid,p_payment_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.weddings where id=p_wedding_id for update;
 if not exists(select 1 from public.wedding_members where wedding_id=p_wedding_id and user_id=p_user_id) then raise exception 'Forbidden'; end if;
 if p_vendor_id is not null and not exists(select 1 from public.vendors where id=p_vendor_id and wedding_id=p_wedding_id) then raise exception 'Invalid vendor'; end if;
 if p_payment_id is not null and not exists(select 1 from public.payments where id=p_payment_id and wedding_id=p_wedding_id and vendor_id=p_vendor_id) then raise exception 'Invalid payment'; end if;
 if (select count(*) from public.documents where wedding_id=p_wedding_id)>=100 then raise exception 'Document limit'; end if;
 insert into public.documents(id,wedding_id,name,mime_type,size_bytes,vendor_id,payment_id) values(p_id,p_wedding_id,trim(p_name),p_mime_type,p_size,p_vendor_id,p_payment_id);
end; $$;
revoke all on function public.register_document(uuid,uuid,uuid,text,text,integer,uuid,uuid) from public,anon,authenticated;
grant execute on function public.register_document(uuid,uuid,uuid,text,text,integer,uuid,uuid) to service_role;


create function private.depart_wedding(u uuid) returns void language plpgsql security definer set search_path='' as $$
declare w uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select wedding_id into w from public.wedding_members where user_id=u;
 if w is null then return; end if;
 perform 1 from public.weddings where id=w for update;
 if (select count(*) from public.wedding_members where wedding_id=w)=1 then
   -- Storage bytes must be removed via the Storage API before cascading metadata.
   if exists(select 1 from public.documents where wedding_id=w) then raise exception 'Remove documents first'; end if;
   delete from public.weddings where id=w;
 else
   delete from public.wedding_members where wedding_id=w and user_id=u;
   update public.wedding_members set role='owner' where wedding_id=w;
   delete from private.invites where wedding_id=w;
 end if;
end; $$;
revoke all on function private.depart_wedding(uuid) from public,anon,authenticated;
create function public.leave_wedding() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform private.depart_wedding(auth.uid());
end; $$;
create function public.delete_my_account() returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform private.depart_wedding(u);
 delete from auth.users where id=u;
end; $$;
revoke all on function public.leave_wedding(),public.delete_my_account() from public,anon;
grant execute on function public.leave_wedding(),public.delete_my_account() to authenticated;

do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
   alter publication supabase_realtime add table public.weddings,public.wedding_members,public.documents;
 end if;
end $$;
commit;
