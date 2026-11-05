import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const a = "00000000-0000-0000-0000-00000000000a",
  b = "00000000-0000-0000-0000-00000000000b",
  c = "00000000-0000-0000-0000-00000000000c",
  d = "00000000-0000-0000-0000-00000000000d";
test("full migration chain: shared details, document isolation, ownership and account lifecycle", async (t) => {
  const db = new PGlite();
  const as = async (user: string, role = "authenticated") => {
    await db.exec(
      `reset role;set request.jwt.claim.sub='${user}';set role ${role}`,
    );
  };
  const scalar = async <T>(sql: string, args: unknown[] = []) =>
    Object.values((await db.query(sql, args)).rows[0] as object)[0] as T;
  try {
    await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;create publication supabase_realtime;create schema auth;create schema extensions;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to authenticated,service_role;
 create function extensions.gen_random_bytes(n integer) returns bytea language sql as $$select decode(repeat('ab',n),'hex')$$;
 create function extensions.digest(v text,algorithm text) returns bytea language sql as $$select sha256(convert_to(v,'UTF8'))$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key,bucket_id text,name text,owner_id text);
 alter table storage.objects enable row level security;grant select on storage.objects to authenticated;
 insert into auth.users values('${a}'),('${b}'),('${c}'),('${d}');`);
    for (const name of readdirSync("supabase/migrations").sort()) {
      let sql = readFileSync("supabase/migrations/" + name, "utf8").replace(
        "create extension if not exists pgcrypto with schema extensions;",
        "",
      );
      await db.exec(sql);
    }
    const published = await db.query<{ tablename: string }>(
      "select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'",
    );
    for (const table of ["weddings", "wedding_members", "documents"])
      assert.ok(published.rows.some((row) => row.tablename === table));
    await as(a);
    const w = await scalar<string>(
      `select create_wedding('','','2027-01-04',1000)`,
    );
    const token = await scalar<string>("select create_invite($1)", [w]);
    await as(b);
    await db.query("select accept_invite($1)", [token]);
    await as(c);
    const other = await scalar<string>(
      `select create_wedding('other','',null,null)`,
    );
    const doc = "10000000-0000-4000-8000-000000000001",
      vendor = "10000000-0000-4000-8000-000000000002",
      foreignVendor = "10000000-0000-4000-8000-000000000003";
    await t.test(
      "shared details are versioned independently of budget; strangers denied",
      async () => {
        await as(a);
        await db.query(
          `select save_wedding_details($1,1,'ראשון','שני','2027-01-04')`,
          [w],
        );
        await assert.rejects(
          db.query(`select save_wedding_details($1,1,'lost','','2027-01-04')`, [
            w,
          ]),
          /Conflict/,
        );
        await as(b);
        assert.equal(
          await scalar("select partner_one from weddings where id=$1", [w]),
          "ראשון",
        );
        await db.query("select set_wedding_budget($1,1,2000)", [w]);
        assert.equal(
          await scalar("select details_version from weddings where id=$1", [w]),
          2,
        );
        await as(c);
        await assert.rejects(
          db.query(`select save_wedding_details($1,2,'bad','',null)`, [w]),
          /Forbidden/,
        );
      },
    );
    await t.test(
      "document registration is server-only and checks current membership and tenant links",
      async () => {
        await as(a);
        await assert.rejects(
          db.query(
            `insert into documents(id,wedding_id,name,mime_type,size_bytes) values($1,$2,'x','application/pdf',10)`,
            [doc, w],
          ),
        );
        await assert.rejects(
          db.query(
            `select register_document($1,$2,$3,'x','application/pdf',10,null,null)`,
            [a, doc, w],
          ),
        );
        await db.exec("reset role");
        await db.query(
          `insert into vendors(id,wedding_id,name,category,status) values($1,$2,'v','other','researching'),($3,$4,'o','other','researching')`,
          [vendor, w, foreignVendor, other],
        );
        await db.query(
          `select register_document($1,$2,$3,'חוזה.pdf','application/pdf',10,$4,null)`,
          [a, doc, w, vendor],
        );
        await assert.rejects(
          db.query(
            `select register_document($1,'10000000-0000-4000-8000-000000000004',$2,'x','application/pdf',10,$3,null)`,
            [a, w, foreignVendor],
          ),
          /Invalid vendor/,
        );
        await assert.rejects(
          db.query(
            `select register_document($1,'10000000-0000-4000-8000-000000000004',$2,'x','application/pdf',10,null,null)`,
            [c, w],
          ),
          /Forbidden/,
        );
        await db.query(
          `insert into storage.objects(id,bucket_id,name) values($1,'wedding-documents',$2)`,
          [doc, `${w}/${doc}`],
        );
        await as(b);
        assert.equal(await scalar("select count(*)::int from documents"), 1);
        assert.equal(
          await scalar("select count(*)::int from storage.objects"),
          1,
        );
        await as(c);
        assert.equal(await scalar("select count(*)::int from documents"), 0);
        assert.equal(
          await scalar("select count(*)::int from storage.objects"),
          0,
        );
        await db.exec("reset role");
        await db.query("delete from vendors where id=$1", [vendor]);
        assert.equal(
          await scalar("select vendor_id from documents where id=$1", [doc]),
          null,
        );
      },
    );
    await t.test(
      "owner departure retains shared data, promotes partner without swapping their slot, and revokes access",
      async () => {
        await as(a);
        await db.query("select leave_wedding()");
        assert.equal(await scalar("select count(*)::int from documents"), 0);
        await as(b);
        assert.equal(
          await scalar("select role from wedding_members where user_id=$1", [
            b,
          ]),
          "owner",
        );
        assert.equal(
          await scalar(
            "select member_slot from wedding_members where user_id=$1",
            [b],
          ),
          "two",
        );
        assert.equal(await scalar("select count(*)::int from documents"), 1);
        const replacement = await scalar<string>("select create_invite($1)", [
          w,
        ]);
        await as(d);
        await db.query("select accept_invite($1)", [replacement]);
        assert.equal(
          await scalar(
            "select member_slot from wedding_members where user_id=$1",
            [d],
          ),
          "one",
        );
      },
    );
    await t.test(
      "account deletion keeps remaining partner data, final departure blocks until documents removed",
      async () => {
        await as(d);
        await db.query("select delete_my_account()");
        await db.exec("reset role");
        assert.equal(
          await scalar("select count(*)::int from auth.users where id=$1", [d]),
          0,
        );
        await as(b);
        await assert.rejects(
          db.query("select delete_my_account()"),
          /Remove documents first/,
        );
        assert.equal(await scalar("select count(*)::int from documents"), 1);
        // Storage API removal is external. Simulate completed removal before metadata deletion.
        await db.exec("reset role");
        await db.query("delete from storage.objects where id=$1", [doc]);
        await db.query("delete from documents where id=$1", [doc]);
        await as(b);
        await db.query("select delete_my_account()");
        await db.exec("reset role");
        assert.equal(
          await scalar("select count(*)::int from weddings where id=$1", [w]),
          0,
        );
        assert.equal(
          await scalar("select count(*)::int from auth.users where id=$1", [b]),
          0,
        );
        await as("", "anon");
        await assert.rejects(db.query("select delete_my_account()"));
        await assert.rejects(db.query("select leave_wedding()"));
      },
    );
  } finally {
    await db.close();
  }
});
