import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const w = "00000000-0000-0000-0000-000000000001",
  other = "00000000-0000-0000-0000-000000000002",
  id = "00000000-0000-0000-0000-000000000031";
test("guest SQL migration enforces counts, versions, membership and privacy", async (t) => {
  const db = new PGlite();
  async function save(
    expected: number | null,
    status = "pending",
    adults = 0,
    children = 0,
    wedding = w,
  ) {
    return db.query(
      `select save_guest($1,$2,$3,'משפחה','איש קשר','0501234567','one','משפחה',3,2,$4,$5,$6,'מנה טבעונית אחת','הערה')`,
      [id, wedding, expected, status, adults, children],
    );
  }
  try {
    await db.exec(readFileSync("tests/fixtures/finance-base.sql", "utf8"));
    await db.exec(
      readFileSync("supabase/migrations/202611030004_guests_rsvp.sql", "utf8"),
    );
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000a'`,
    );
    await t.test(
      "create retries are idempotent and partial RSVP counts persist",
      async () => {
        await save(null);
        await save(null);
        assert.equal(
          (await db.query("select * from guest_invitations")).rows.length,
          1,
        );
        await save(1, "confirmed", 2, 1);
        const r = await db.query<{
          version: number;
          confirmed_adults: number;
          confirmed_children: number;
        }>(
          "select version,confirmed_adults,confirmed_children from guest_invitations",
        );
        assert.deepEqual(r.rows[0], {
          version: 2,
          confirmed_adults: 2,
          confirmed_children: 1,
        });
      },
    );
    await t.test(
      "invalid counts and inconsistent RSVP states are rejected by PostgreSQL",
      async () => {
        await assert.rejects(save(2, "confirmed", 4, 0));
        await assert.rejects(save(2, "confirmed", 0, 3));
        await assert.rejects(save(2, "confirmed", 0, 0));
        await assert.rejects(save(2, "pending", 1, 0));
        await assert.rejects(save(2, "declined", 0, 1));
        await assert.rejects(
          db.query(
            `select save_guest('00000000-0000-0000-0000-000000000032',$1,null,'bad','','','shared','',0,0,'pending',0,0,'','')`,
            [w],
          ),
        );
      },
    );
    await t.test(
      "stale updates/deletes and direct table mutations are denied",
      async () => {
        await assert.rejects(save(1));
        await assert.rejects(db.query("select delete_guest($1,1)", [id]));
        await assert.rejects(
          db.query(`update guest_invitations set confirmed_adults=0`),
        );
        await assert.rejects(db.query("delete from guest_invitations"));
        const r = await db.query<{ version: number }>(
          "select version from guest_invitations",
        );
        assert.equal(r.rows[0].version, 2);
      },
    );
    await t.test(
      "unrelated wedding accounts cannot read or mutate contact/dietary data",
      async () => {
        await db.exec(
          `set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000c'`,
        );
        assert.equal(
          (await db.query("select * from guest_invitations")).rows.length,
          0,
        );
        await assert.rejects(save(null));
        await assert.rejects(save(2, "pending", 0, 0, other));
        await assert.rejects(db.query("select delete_guest($1,2)", [id]));
      },
    );
    await t.test(
      "the other partner shares the same invitation and can delete its current version",
      async () => {
        await db.exec(
          `set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000b'`,
        );
        const r = await db.query<{ side: string; dietary: string }>(
          "select side,dietary from guest_invitations",
        );
        assert.equal(r.rows[0].side, "one");
        assert.equal(r.rows[0].dietary, "מנה טבעונית אחת");
        await db.query("select delete_guest($1,2)", [id]);
        assert.equal(
          (await db.query("select * from guest_invitations")).rows.length,
          0,
        );
      },
    );
    await t.test("anonymous requests cannot invoke guest RPCs", async () => {
      await db.exec("reset role;set role anon");
      await assert.rejects(save(null));
    });
  } finally {
    await db.close();
  }
});
