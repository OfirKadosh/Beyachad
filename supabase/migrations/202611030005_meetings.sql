begin;
create table public.meetings (
 id uuid primary key,
 wedding_id uuid not null references public.weddings(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 100),
 starts_at timestamptz not null check(starts_at>='1900-01-01T00:00:00Z' and starts_at<'2201-01-01T00:00:00Z'),
 time_zone text not null check(length(time_zone) between 1 and 100),
 duration_minutes integer not null check(duration_minutes between 15 and 1440),
 location text not null default '' check(length(location)<=300),
 vendor_id uuid references public.vendors(id) on delete set null,
 owner text not null default 'both' check(owner in ('both','one','two')),
 status text not null default 'scheduled' check(status in ('scheduled','done','cancelled')),
 reminder_minutes integer check(reminder_minutes in (0,15,60,1440)),
 notes text not null default '' check(length(notes)<=2000),
 version integer not null default 1
);
alter table public.meetings enable row level security;
create policy meeting_read on public.meetings for select to authenticated using(private.is_member(wedding_id));
revoke all on public.meetings from public,anon,authenticated;
grant select on public.meetings to authenticated;
create index meeting_wedding_start on public.meetings(wedding_id,starts_at);
create function private.meeting_version() returns trigger language plpgsql set search_path='' as $$ begin new.version:=old.version+1;return new;end; $$;
create trigger meeting_version before update on public.meetings for each row execute function private.meeting_version();
create function public.save_meeting(p_id uuid,p_wedding_id uuid,p_expected_version integer,p_title text,p_starts_at timestamptz,p_time_zone text,p_duration_minutes integer,p_location text,p_vendor_id uuid,p_owner text,p_status text,p_reminder_minutes integer,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare m public.meetings;
begin
 if not private.is_member(p_wedding_id) then raise exception 'לא קיימת גישה לחתונה.';end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_time_zone) then raise exception 'אזור הזמן אינו תקין.';end if;
 -- Lock linked vendor before meeting; same order as vendor deletion/FK cleanup.
 if p_vendor_id is not null then
  perform 1 from public.vendors where id=p_vendor_id and wedding_id=p_wedding_id for key share;
  if not found then raise exception 'הספק אינו שייך לחתונה או שנמחק.';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,3));
 select * into m from public.meetings where id=p_id for update;
 if found then
  if m.wedding_id<>p_wedding_id then raise exception 'לא קיימת גישה לפגישה.';end if;
  if p_expected_version is null then
   if (m.title,m.starts_at,m.time_zone,m.duration_minutes,m.location,m.vendor_id,m.owner,m.status,m.reminder_minutes,m.notes) is not distinct from (trim(p_title),p_starts_at,p_time_zone,p_duration_minutes,trim(p_location),p_vendor_id,p_owner,p_status,p_reminder_minutes,trim(p_notes)) then return m.id;end if;
   raise exception 'הפגישה השתנתה ממכשיר אחר.' using errcode='40001';
  end if;
  if m.version<>p_expected_version then raise exception 'הפגישה השתנתה ממכשיר אחר.' using errcode='40001';end if;
  update public.meetings set title=trim(p_title),starts_at=p_starts_at,time_zone=p_time_zone,duration_minutes=p_duration_minutes,location=trim(p_location),vendor_id=p_vendor_id,owner=p_owner,status=p_status,reminder_minutes=p_reminder_minutes,notes=trim(p_notes) where id=p_id;
 else
  if p_expected_version is not null then raise exception 'הפגישה השתנתה או נמחקה.' using errcode='40001';end if;
  insert into public.meetings(id,wedding_id,title,starts_at,time_zone,duration_minutes,location,vendor_id,owner,status,reminder_minutes,notes) values(p_id,p_wedding_id,trim(p_title),p_starts_at,p_time_zone,p_duration_minutes,trim(p_location),p_vendor_id,p_owner,p_status,p_reminder_minutes,trim(p_notes));
 end if;
 return p_id;
end;$$;
create function public.delete_meeting(p_id uuid,p_expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare m public.meetings;
begin
 select * into m from public.meetings where id=p_id for update;
 if not found or not private.is_member(m.wedding_id) then raise exception 'לא קיימת גישה לפגישה.';end if;
 if p_expected_version is null or m.version<>p_expected_version then raise exception 'הפגישה השתנתה ממכשיר אחר.' using errcode='40001';end if;
 delete from public.meetings where id=p_id;
end;$$;
revoke all on function public.save_meeting(uuid,uuid,integer,text,timestamptz,text,integer,text,uuid,text,text,integer,text),public.delete_meeting(uuid,integer) from public,anon;
grant execute on function public.save_meeting(uuid,uuid,integer,text,timestamptz,text,integer,text,uuid,text,text,integer,text),public.delete_meeting(uuid,integer) to authenticated;
alter table public.meetings replica identity full;
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.meetings;end if;end $$;
commit;
