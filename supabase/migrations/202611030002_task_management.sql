begin;
-- Stable wedding slots, never viewer-relative "me"/"partner" assignments.
alter table public.tasks drop constraint tasks_owner_check;
update public.tasks set owner = case owner when 'me' then 'one' when 'partner' then 'two' else owner end;
alter table public.tasks add constraint tasks_owner_check check(owner in ('both','one','two'));
alter table public.tasks
  add column status text not null default 'todo' check(status in ('todo','in_progress','done')),
  add column priority text not null default 'normal' check(priority in ('low','normal','high')),
  add column category text not null default 'general' check(category in ('general','budget','venue','guests','vendors','personal')),
  add column due_date date,
  add column notes text not null default '' check(length(notes)<=2000);
update public.tasks set status = case when completed then 'done' else 'todo' end;
-- Keep completed synchronized for clients upgrading from v0.1.
create or replace function private.bump_task_version() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    new.completed := new.status = 'done';
  elsif new.completed is distinct from old.completed then
    new.status := case when new.completed then 'done' else 'todo' end;
  end if;
  new.version := old.version + 1;
  return new;
end;
$$;
create function private.task_insert_status() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.completed and new.status = 'todo' then new.status := 'done'; end if;
  new.completed := new.status = 'done';
  return new;
end;
$$;
create trigger task_insert_status before insert on public.tasks for each row execute function private.task_insert_status();
grant insert(owner,status,priority,category,due_date,notes), update(title,owner,status,priority,category,due_date,notes) on public.tasks to authenticated;
create index tasks_due_date on public.tasks(wedding_id,due_date) where not completed;
commit;
