begin;
create table public.guest_invitations (
 id uuid primary key,
 wedding_id uuid not null references public.weddings(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100),
 contact text not null default '' check(length(contact)<=100),
 phone text not null default '' check(length(phone)<=40),
 side text not null default 'shared' check(side in ('one','two','shared')),
 group_name text not null default '' check(length(group_name)<=50),
 invited_adults integer not null default 1 check(invited_adults between 0 and 100),
 invited_children integer not null default 0 check(invited_children between 0 and 100),
 rsvp text not null default 'pending' check(rsvp in ('pending','confirmed','declined')),
 confirmed_adults integer not null default 0 check(confirmed_adults between 0 and invited_adults),
 confirmed_children integer not null default 0 check(confirmed_children between 0 and invited_children),
 dietary text not null default '' check(length(dietary)<=1000),
 notes text not null default '' check(length(notes)<=2000),
 version integer not null default 1,
 check(invited_adults+invited_children between 1 and 100),
 check((rsvp='confirmed' and confirmed_adults+confirmed_children>0) or (rsvp<>'confirmed' and confirmed_adults+confirmed_children=0))
);
alter table public.guest_invitations enable row level security;
create policy guests_read on public.guest_invitations for select to authenticated using(private.is_member(wedding_id));
revoke all on public.guest_invitations from public,anon,authenticated;
grant select on public.guest_invitations to authenticated;
create index guest_wedding_status on public.guest_invitations(wedding_id,rsvp);

create function public.save_guest(p_id uuid,p_wedding_id uuid,p_expected_version integer,p_name text,p_contact text,p_phone text,p_side text,p_group_name text,p_invited_adults integer,p_invited_children integer,p_rsvp text,p_confirmed_adults integer,p_confirmed_children integer,p_dietary text,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare g public.guest_invitations;
begin
 if not private.is_member(p_wedding_id) then raise exception 'לא קיימת גישה לחתונה.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,2));
 select * into g from public.guest_invitations where id=p_id for update;
 if found then
  if g.wedding_id<>p_wedding_id then raise exception 'לא קיימת גישה להזמנה.'; end if;
  if p_expected_version is null then
   if (g.name,g.contact,g.phone,g.side,g.group_name,g.invited_adults,g.invited_children,g.rsvp,g.confirmed_adults,g.confirmed_children,g.dietary,g.notes) is not distinct from (trim(p_name),trim(p_contact),trim(p_phone),p_side,trim(p_group_name),p_invited_adults,p_invited_children,p_rsvp,p_confirmed_adults,p_confirmed_children,trim(p_dietary),trim(p_notes)) then return g.id; end if;
   raise exception 'ההזמנה השתנתה ממכשיר אחר.' using errcode='40001';
  end if;
  if g.version<>p_expected_version then raise exception 'ההזמנה השתנתה ממכשיר אחר.' using errcode='40001'; end if;
  update public.guest_invitations set name=trim(p_name),contact=trim(p_contact),phone=trim(p_phone),side=p_side,group_name=trim(p_group_name),invited_adults=p_invited_adults,invited_children=p_invited_children,rsvp=p_rsvp,confirmed_adults=p_confirmed_adults,confirmed_children=p_confirmed_children,dietary=trim(p_dietary),notes=trim(p_notes),version=version+1 where id=p_id;
 else
  if p_expected_version is not null then raise exception 'ההזמנה השתנתה או נמחקה.' using errcode='40001'; end if;
  insert into public.guest_invitations(id,wedding_id,name,contact,phone,side,group_name,invited_adults,invited_children,rsvp,confirmed_adults,confirmed_children,dietary,notes) values(p_id,p_wedding_id,trim(p_name),trim(p_contact),trim(p_phone),p_side,trim(p_group_name),p_invited_adults,p_invited_children,p_rsvp,p_confirmed_adults,p_confirmed_children,trim(p_dietary),trim(p_notes));
 end if;
 return p_id;
end;
$$;
create function public.delete_guest(p_id uuid,p_expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare g public.guest_invitations;
begin
 select * into g from public.guest_invitations where id=p_id for update;
 if not found or not private.is_member(g.wedding_id) then raise exception 'לא קיימת גישה להזמנה.'; end if;
 if p_expected_version is null or g.version<>p_expected_version then raise exception 'ההזמנה השתנתה ממכשיר אחר.' using errcode='40001'; end if;
 delete from public.guest_invitations where id=p_id;
end;
$$;
revoke all on function public.save_guest(uuid,uuid,integer,text,text,text,text,text,integer,integer,text,integer,integer,text,text), public.delete_guest(uuid,integer) from public,anon;
grant execute on function public.save_guest(uuid,uuid,integer,text,text,text,text,text,integer,integer,text,integer,integer,text,text), public.delete_guest(uuid,integer) to authenticated;
alter table public.guest_invitations replica identity full;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.guest_invitations; end if;
end $$;
commit;
