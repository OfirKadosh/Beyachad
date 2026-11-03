import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const w = "00000000-0000-0000-0000-000000000001",
  other = "00000000-0000-0000-0000-000000000002",
  id = "00000000-0000-0000-0000-000000000041",
  vendor = "00000000-0000-0000-0000-000000000011";
test("meeting migration protects tenant links, versions and vendor-unlink history", async (t) => {
  const db = new PGlite();
  const save = (
    expected: number | null,
    vendorId: string | null = vendor,
    wedding = w,
    zone = "Asia/Jerusalem",
  ) =>
    db.query(
      `select save_meeting($1,$2,$3,'טעימות','2027-01-04T10:00:00Z',$4,60,'חיפה',$5,'both','scheduled',60,'הערות')`,
      [id, wedding, expected, zone, vendorId],
    );
  try {
    await db.exec(readFileSync("tests/fixtures/finance-base.sql", "utf8"));
    await db.exec(
      `create table public.vendors(id uuid primary key,wedding_id uuid references public.weddings);insert into public.vendors values('${vendor}','${w}'),('00000000-0000-0000-0000-000000000012','${other}');`,
    );
    await db.exec(
      readFileSync("supabase/migrations/202611030005_meetings.sql", "utf8"),
    );
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000a'`,
    );
    await t.test(
      "create retries are idempotent and dates preserve instants",
      async () => {
        await save(null);
        await save(null);
        const r = await db.query<{
          version: number;
          time_zone: string;
          starts_at: Date;
        }>("select version,time_zone,starts_at from meetings");
        assert.equal(r.rows.length, 1);
        assert.equal(r.rows[0].version, 1);
        assert.equal(r.rows[0].time_zone, "Asia/Jerusalem");
        assert.equal(
          new Date(r.rows[0].starts_at).toISOString(),
          "2027-01-04T10:00:00.000Z",
        );
      },
    );
    await t.test(
      "cross-wedding suppliers, invalid zones and direct mutations fail",
      async () => {
        await assert.rejects(save(1, "00000000-0000-0000-0000-000000000012"));
        await assert.rejects(save(1, vendor, w, "Fake/Zone"));
        await assert.rejects(
          db.query("update meetings set duration_minutes=15"),
        );
        await assert.rejects(db.query("delete from meetings"));
        await save(1);
        await assert.rejects(save(1));
        await assert.rejects(db.query("select delete_meeting($1,1)", [id]));
      },
    );
    await t.test(
      "unrelated members cannot read or change another wedding meeting",
      async () => {
        await db.exec(
          `set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000c'`,
        );
        assert.equal((await db.query("select * from meetings")).rows.length, 0);
        await assert.rejects(save(2));
        await assert.rejects(save(2, null, other));
      },
    );
    await t.test(
      "deleting a vendor preserves its meeting and invalidates stale editors",
      async () => {
        await db.exec(
          `reset role;delete from vendors where id='${vendor}';set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000b'`,
        );
        const r = await db.query<{ vendor_id: string | null; version: number }>(
          "select vendor_id,version from meetings",
        );
        assert.equal(r.rows[0].vendor_id, null);
        assert.equal(r.rows[0].version, 3);
        await assert.rejects(save(2, null));
        await db.query("select delete_meeting($1,3)", [id]);
        assert.equal((await db.query("select * from meetings")).rows.length, 0);
      },
    );
    await t.test("anonymous callers cannot invoke meeting RPCs", async () => {
      await db.exec("reset role;set role anon");
      await assert.rejects(save(null, null));
    });
  } finally {
    await db.close();
  }
});
