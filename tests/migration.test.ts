import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// A minimal v0.1 schema fixture exercises the new migration in real PostgreSQL
// semantics, including RLS. This does not emulate hosted Supabase Auth/Realtime.
const fixture = `
create role authenticated;
create schema private; create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,private to authenticated;
create table public.weddings(id uuid primary key);
create table public.wedding_members(wedding_id uuid references public.weddings,user_id uuid,role text);
create table public.tasks(id uuid primary key default gen_random_uuid(),wedding_id uuid references public.weddings,title text not null check(length(trim(title)) between 1 and 160),owner text not null default 'both' constraint tasks_owner_check check(owner in ('both','me','partner')),completed boolean not null default false,recommendation_key text,version integer not null default 1,created_at timestamptz default now());
create function private.is_member(w uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.wedding_members where wedding_id=w and user_id=auth.uid()) $$;
alter table public.tasks enable row level security;
create policy task_read on public.tasks for select to authenticated using(private.is_member(wedding_id));
create policy task_insert on public.tasks for insert to authenticated with check(private.is_member(wedding_id));
create policy task_update on public.tasks for update to authenticated using(private.is_member(wedding_id)) with check(private.is_member(wedding_id));
create policy task_delete on public.tasks for delete to authenticated using(private.is_member(wedding_id));
grant select,delete on public.tasks to authenticated;
grant insert(wedding_id,title,recommendation_key),update(completed) on public.tasks to authenticated;
create function private.bump_task_version() returns trigger language plpgsql set search_path='' as $$ begin new.version:=old.version+1;return new;end; $$;
create trigger task_version before update on public.tasks for each row execute function private.bump_task_version();
insert into public.weddings values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into public.wedding_members values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','owner'),('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','partner'),('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000c','owner');
insert into public.tasks(id,wedding_id,title,owner,completed) values('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','legacy','me',true),('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000002','private','both',false);
`;
test("task migration upgrades existing data, enforces permissions and version checks", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(fixture);
    await db.exec(
      readFileSync(
        "supabase/migrations/202611030002_task_management.sql",
        "utf8",
      ),
    );
    await t.test(
      "existing completed tasks keep their status and stable owner",
      async () => {
        const { rows } = await db.query<{
          owner: string;
          status: string;
          completed: boolean;
        }>(`select owner,status,completed from tasks where title='legacy'`);
        assert.deepEqual(rows[0], {
          owner: "one",
          status: "done",
          completed: true,
        });
      },
    );
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000a';`,
    );
    await t.test(
      "a member sees only their wedding and can edit permitted fields",
      async () => {
        const visible = await db.query("select * from tasks");
        assert.equal(visible.rows.length, 1);
        const changed = await db.query(
          `update tasks set title='edited',owner='two',status='in_progress',priority='high',category='venue',due_date='2027-01-01',notes='a note' where title='legacy' returning completed,status,version`,
        );
        assert.equal(
          (changed.rows[0] as { completed: boolean }).completed,
          false,
        );
        const version = (changed.rows[0] as { version: number }).version;
        assert.equal(
          (
            await db.query(
              "update tasks set title=$1 where version=$2 returning id",
              ["stale", version - 1],
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query("delete from tasks where version=$1 returning id", [
              version - 1,
            ])
          ).rows.length,
          0,
        );
      },
    );
    await t.test(
      "cross-wedding updates/deletes and protected-column edits are blocked",
      async () => {
        assert.equal(
          (
            await db.query(
              `update tasks set title='forbidden' where title='private' returning id`,
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              `delete from tasks where title='private' returning id`,
            )
          ).rows.length,
          0,
        );
        await assert.rejects(
          db.query(
            `update tasks set wedding_id='00000000-0000-0000-0000-000000000002'`,
          ),
        );
        await assert.rejects(db.query(`update tasks set version=999`));
        await assert.rejects(
          db.query(
            `insert into tasks(wedding_id,title) values('00000000-0000-0000-0000-000000000002','forbidden')`,
          ),
        );
        await assert.rejects(db.query(`update tasks set priority='urgent'`));
      },
    );
    await t.test(
      "legacy completion updates and new insert status remain synchronized",
      async () => {
        const legacy = await db.query<{ status: string }>(
          `update tasks set completed=true returning status`,
        );
        assert.equal(legacy.rows[0].status, "done");
        const fresh = await db.query<{ completed: boolean }>(
          `insert into tasks(wedding_id,title,status) values('00000000-0000-0000-0000-000000000001','new','done') returning completed`,
        );
        assert.equal(fresh.rows[0].completed, true);
      },
    );
    await t.test(
      "the other partner shares stable assignments and can delete their wedding tasks",
      async () => {
        await db.exec(
          `set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000b';`,
        );
        const own = await db.query<{ owner: string }>(
          `select owner from tasks where title='edited'`,
        );
        assert.equal(own.rows[0].owner, "two");
        assert.equal(
          (await db.query(`delete from tasks where title='new' returning id`))
            .rows.length,
          1,
        );
        await db.exec(
          `set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000c';`,
        );
        const unrelated = await db.query<{ title: string }>(
          "select title from tasks",
        );
        assert.deepEqual(
          unrelated.rows.map((r) => r.title),
          ["private"],
        );
      },
    );
  } finally {
    await db.close();
  }
});
