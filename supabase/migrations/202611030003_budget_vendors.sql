begin;
alter table public.weddings add column budget_version integer not null default 1;
create table public.vendors (
  id uuid primary key,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 100),
  category text not null check(category in ('venue','photo','music','design','clothing','other')),
  status text not null check(status in ('researching','quoted','booked','rejected')),
  contact text not null default '' check(length(contact)<=100),
  phone text not null default '' check(length(phone)<=40),
  quote_cents bigint check(quote_cents between 0 and 100000000000),
  agreed_cents bigint check(agreed_cents between 0 and 100000000000),
  notes text not null default '' check(length(notes)<=2000),
  version integer not null default 1,
  check(status<>'booked' or agreed_cents is not null),
  unique(id,wedding_id)
);
create table public.payments (
  id uuid primary key,
  vendor_id uuid not null,
  wedding_id uuid not null,
  label text not null check(length(trim(label)) between 1 and 100),
  amount_cents bigint not null check(amount_cents between 1 and 100000000000),
  due_date date,
  paid_date date,
  version integer not null default 1,
  check(due_date is not null or paid_date is not null),
  foreign key(vendor_id,wedding_id) references public.vendors(id,wedding_id) on delete restrict
);
alter table public.vendors enable row level security;
alter table public.payments enable row level security;
create policy vendor_read on public.vendors for select to authenticated using(private.is_member(wedding_id));
create policy payment_read on public.payments for select to authenticated using(private.is_member(wedding_id));
revoke all on public.vendors, public.payments from public,anon,authenticated;
grant select on public.vendors,public.payments to authenticated;
create index vendors_wedding on public.vendors(wedding_id);
create index payments_vendor on public.payments(vendor_id);

-- All finance mutations go through these transactional, membership-checked RPCs.
create function public.save_vendor(p_id uuid,p_wedding_id uuid,p_expected_version integer,p_name text,p_category text,p_status text,p_contact text,p_phone text,p_quote_cents bigint,p_agreed_cents bigint,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v public.vendors; allocated bigint;
begin
  if not private.is_member(p_wedding_id) then raise exception 'לא קיימת גישה לחתונה.'; end if;
  -- Serializes create retries before the row exists, and updates to the same vendor.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,1));
  select * into v from public.vendors where id=p_id for update;
  if found then
    if v.wedding_id<>p_wedding_id then raise exception 'לא קיימת גישה לספק.'; end if;
    if p_expected_version is null then
      if (v.name,v.category,v.status,v.contact,v.phone,v.quote_cents,v.agreed_cents,v.notes) is not distinct from (trim(p_name),p_category,p_status,trim(p_contact),trim(p_phone),p_quote_cents,p_agreed_cents,trim(p_notes)) then return v.id; end if;
      raise exception 'הרישום השתנה ממכשיר אחר.' using errcode='40001';
    end if;
    if v.version<>p_expected_version then raise exception 'הרישום השתנה ממכשיר אחר.' using errcode='40001'; end if;
    select coalesce(sum(amount_cents),0) into allocated from public.payments where vendor_id=p_id;
    if exists(select 1 from public.payments where vendor_id=p_id) and (p_status<>'booked' or p_agreed_cents is null or p_agreed_cents<allocated) then raise exception 'לא ניתן לשנות את הסגירה או המחיר בלי לטפל ברישומי התשלום הקיימים.'; end if;
    update public.vendors set name=trim(p_name),category=p_category,status=p_status,contact=trim(p_contact),phone=trim(p_phone),quote_cents=p_quote_cents,agreed_cents=p_agreed_cents,notes=trim(p_notes),version=version+1 where id=p_id;
  else
    if p_expected_version is not null then raise exception 'הרישום השתנה או נמחק.' using errcode='40001'; end if;
    insert into public.vendors(id,wedding_id,name,category,status,contact,phone,quote_cents,agreed_cents,notes) values(p_id,p_wedding_id,trim(p_name),p_category,p_status,trim(p_contact),trim(p_phone),p_quote_cents,p_agreed_cents,trim(p_notes));
  end if;
  return p_id;
end;
$$;
create function public.delete_vendor(p_id uuid,p_expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare v public.vendors;
begin
  select * into v from public.vendors where id=p_id for update;
  if not found or not private.is_member(v.wedding_id) then raise exception 'לא קיימת גישה לספק.'; end if;
  if p_expected_version is null or v.version<>p_expected_version then raise exception 'הרישום השתנה ממכשיר אחר.' using errcode='40001'; end if;
  if exists(select 1 from public.payments where vendor_id=p_id) then raise exception 'לספק יש רישומי תשלום. יש לטפל בהם לפני מחיקת הכרטיס.'; end if;
  delete from public.vendors where id=p_id;
end;
$$;
create function public.save_payment(p_id uuid,p_vendor_id uuid,p_vendor_version integer,p_expected_version integer,p_label text,p_amount_cents bigint,p_due_date date,p_paid_date date)
returns uuid language plpgsql security definer set search_path='' as $$
declare v public.vendors; p public.payments; allocated bigint;
begin
  select * into v from public.vendors where id=p_vendor_id for update;
  if not found or not private.is_member(v.wedding_id) then raise exception 'לא קיימת גישה לספק.'; end if;
  select * into p from public.payments where id=p_id for update;
  if found then
    if p.vendor_id<>p_vendor_id then raise exception 'לא קיימת גישה לתשלום.'; end if;
    if p_expected_version is null then
      if (p.label,p.amount_cents,p.due_date,p.paid_date) is not distinct from (trim(p_label),p_amount_cents,p_due_date,p_paid_date) then return p.id; end if;
      raise exception 'הרישום השתנה ממכשיר אחר.' using errcode='40001';
    end if;
    if p.version<>p_expected_version then raise exception 'הרישום השתנה ממכשיר אחר.' using errcode='40001'; end if;
  elsif p_expected_version is not null then raise exception 'התשלום השתנה או נמחק.' using errcode='40001'; end if;
  if p_vendor_version is null or v.version<>p_vendor_version then raise exception 'הספק השתנה ממכשיר אחר.' using errcode='40001'; end if;
  if v.status<>'booked' then raise exception 'אפשר לרשום תשלומים רק לספק שנסגר.'; end if;
  select coalesce(sum(amount_cents),0) into allocated from public.payments where vendor_id=p_vendor_id and id<>p_id;
  if p_amount_cents is null or p_amount_cents<=0 or allocated+p_amount_cents>v.agreed_cents then raise exception 'סך התשלומים ששולמו ומתוכננים גבוה מהמחיר שסוכם, או שהסכום אינו תקין.'; end if;
  if p.id is null then
    insert into public.payments(id,vendor_id,wedding_id,label,amount_cents,due_date,paid_date) values(p_id,v.id,v.wedding_id,trim(p_label),p_amount_cents,p_due_date,p_paid_date);
  else
    update public.payments set label=trim(p_label),amount_cents=p_amount_cents,due_date=p_due_date,paid_date=p_paid_date,version=version+1 where id=p_id;
  end if;
  update public.vendors set version=version+1 where id=p_vendor_id;
  return p_id;
end;
$$;
create function public.delete_payment(p_id uuid,p_vendor_version integer,p_expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare v public.vendors; p public.payments; vendor_uuid uuid;
begin
  select vendor_id into vendor_uuid from public.payments where id=p_id;
  select * into v from public.vendors where id=vendor_uuid for update;
  if not found or not private.is_member(v.wedding_id) then raise exception 'לא קיימת גישה לתשלום.'; end if;
  select * into p from public.payments where id=p_id for update;
  if not found or p_expected_version is null or p_vendor_version is null or p.version<>p_expected_version or v.version<>p_vendor_version then raise exception 'הרישום השתנה ממכשיר אחר.' using errcode='40001'; end if;
  delete from public.payments where id=p_id;
  update public.vendors set version=version+1 where id=v.id;
end;
$$;
create function public.set_wedding_budget(p_wedding_id uuid,p_expected_version integer,p_budget numeric) returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_member(p_wedding_id) then raise exception 'לא קיימת גישה לחתונה.'; end if;
  if p_budget is not null and (p_budget<0 or p_budget>1000000000 or p_budget<>round(p_budget,2)) then raise exception 'סכום תקציב לא תקין.'; end if;
  update public.weddings set budget=p_budget,budget_version=budget_version+1 where id=p_wedding_id and budget_version=p_expected_version;
  if not found then raise exception 'התקציב השתנה ממכשיר אחר.' using errcode='40001'; end if;
end;
$$;
revoke all on function public.save_vendor(uuid,uuid,integer,text,text,text,text,text,bigint,bigint,text),public.delete_vendor(uuid,integer),public.save_payment(uuid,uuid,integer,integer,text,bigint,date,date),public.delete_payment(uuid,integer,integer),public.set_wedding_budget(uuid,integer,numeric) from public,anon;
grant execute on function public.save_vendor(uuid,uuid,integer,text,text,text,text,text,bigint,bigint,text),public.delete_vendor(uuid,integer),public.save_payment(uuid,uuid,integer,integer,text,bigint,date,date),public.delete_payment(uuid,integer,integer),public.set_wedding_budget(uuid,integer,numeric) to authenticated;
alter table public.vendors replica identity full;
alter table public.payments replica identity full;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.vendors,public.payments,public.weddings;
 end if;
end $$;
commit;
