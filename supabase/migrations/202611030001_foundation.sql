-- Run once in a new Supabase project's SQL editor, or with supabase db push.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create extension if not exists pgcrypto with schema extensions;

create table public.weddings (
  id uuid primary key default gen_random_uuid(),
  partner_one text not null default '' check (length(partner_one) <= 60),
  partner_two text not null default '' check (length(partner_two) <= 60),
  wedding_date date,
  budget numeric check (budget >= 0 and budget <= 1000000000),
  created_at timestamptz not null default now()
);
create table public.wedding_members (
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'partner')),
  primary key (wedding_id, user_id),
  unique (user_id)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  owner text not null default 'both' check (owner in ('both', 'me', 'partner')),
  completed boolean not null default false,
  recommendation_key text check (recommendation_key in ('budget','guests','date','venue','priorities','partner')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  unique(wedding_id, recommendation_key)
);
create table private.invites (
  token_hash text primary key,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days'
);
alter table public.weddings enable row level security;
alter table public.wedding_members enable row level security;
alter table public.tasks enable row level security;
alter table private.invites enable row level security;

create function private.is_member(p_wedding uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.wedding_members where wedding_id = p_wedding and user_id = (select auth.uid()));
$$;
revoke all on function private.is_member(uuid) from public;
grant execute on function private.is_member(uuid) to authenticated;
create policy wedding_read on public.weddings for select to authenticated using (private.is_member(id));
create policy membership_read on public.wedding_members for select to authenticated using (private.is_member(wedding_id));
create policy task_read on public.tasks for select to authenticated using (private.is_member(wedding_id));
create policy task_insert on public.tasks for insert to authenticated with check (private.is_member(wedding_id));
create policy task_update on public.tasks for update to authenticated using (private.is_member(wedding_id)) with check (private.is_member(wedding_id));
create policy task_delete on public.tasks for delete to authenticated using (private.is_member(wedding_id));
-- No client can directly create a wedding/member or read invite hashes.
revoke all on public.weddings, public.wedding_members, public.tasks from anon, authenticated;
grant select on public.weddings, public.wedding_members, public.tasks to authenticated;
grant insert(wedding_id,title,recommendation_key), update(completed), delete on public.tasks to authenticated;

create function private.bump_task_version() returns trigger language plpgsql set search_path = '' as $$
begin new.version := old.version + 1; return new; end;
$$;
create trigger task_version before update on public.tasks for each row execute function private.bump_task_version();

create function public.create_wedding(p_one text default '', p_two text default '', p_date date default null, p_budget numeric default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare w uuid; u uuid := auth.uid();
begin
  if u is null then raise exception 'Authentication required'; end if;
  -- Serializes create/join requests for the same account.
  perform pg_advisory_xact_lock(hashtextextended(u::text, 0));
  if exists(select 1 from public.wedding_members where user_id = u) then raise exception 'Already a member'; end if;
  insert into public.weddings(partner_one,partner_two,wedding_date,budget) values(trim(coalesce(p_one,'')),trim(coalesce(p_two,'')),p_date,p_budget) returning id into w;
  insert into public.wedding_members values(w,u,'owner');
  return w;
end;
$$;
create function public.create_invite(p_wedding_id uuid) returns text language plpgsql security definer set search_path = '' as $$
declare token text;
begin
  perform 1 from public.weddings where id=p_wedding_id for update;
  if not exists(select 1 from public.wedding_members where wedding_id=p_wedding_id and user_id=auth.uid() and role='owner') then raise exception 'Owner required'; end if;
  if (select count(*) from public.wedding_members where wedding_id=p_wedding_id) >= 2 then raise exception 'Wedding full'; end if;
  token := encode(extensions.gen_random_bytes(24),'hex');
  delete from private.invites where wedding_id=p_wedding_id;
  insert into private.invites(token_hash,wedding_id) values(encode(extensions.digest(token,'sha256'),'hex'),p_wedding_id);
  return token;
end;
$$;
create function public.accept_invite(p_token text) returns uuid language plpgsql security definer set search_path = '' as $$
declare w uuid; u uuid := auth.uid(); h text;
begin
  if u is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text, 0));
  if exists(select 1 from public.wedding_members where user_id=u) then raise exception 'Already a member'; end if;
  h := encode(extensions.digest(trim(p_token),'sha256'),'hex');
  select wedding_id into w from private.invites where token_hash=h and expires_at>now();
  if w is null then raise exception 'Invalid invitation'; end if;
  -- Same lock order as create_invite: wedding, then invitation.
  perform 1 from public.weddings where id=w for update;
  if not exists(select 1 from private.invites where token_hash=h and expires_at>now()) then raise exception 'Invitation consumed'; end if;
  if (select count(*) from public.wedding_members where wedding_id=w)>=2 then raise exception 'Wedding full'; end if;
  insert into public.wedding_members values(w,u,'partner');
  delete from private.invites where wedding_id=w;
  return w;
end;
$$;
revoke all on function public.create_wedding(text,text,date,numeric), public.create_invite(uuid), public.accept_invite(text) from public, anon;
grant execute on function public.create_wedding(text,text,date,numeric), public.create_invite(uuid), public.accept_invite(text) to authenticated;
-- Include existing row values for realtime updates; access is still controlled by RLS.
alter table public.tasks replica identity full;
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;
commit;
