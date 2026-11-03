import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const w = "00000000-0000-0000-0000-000000000001",
  other = "00000000-0000-0000-0000-000000000002",
  v = "00000000-0000-0000-0000-000000000011",
  p = "00000000-0000-0000-0000-000000000021";
test("finance migration enforces atomic RPC invariants and tenant boundaries", async (t) => {
  const db = new PGlite();
  const saveVendor = (
    expected: number | null,
    agreed = 10000,
    status = "booked",
    wedding = w,
  ) =>
    db.query(
      `select public.save_vendor($1,$2,$3,'אולם','venue',$4,'איש קשר','050',15000,$5,'הערות')`,
      [v, wedding, expected, status, agreed],
    );
  const savePayment = (
    id: string,
    version: number,
    expected: number | null,
    amount = 2000,
    paid: string | null = null,
  ) =>
    db.query(
      `select public.save_payment($1,$2,$3,$4,'מקדמה',$5,'2026-01-01',$6)`,
      [id, v, version, expected, amount, paid],
    );
  try {
    await db.exec(readFileSync("tests/fixtures/finance-base.sql", "utf8"));
    await db.exec(
      readFileSync(
        "supabase/migrations/202611030003_budget_vendors.sql",
        "utf8",
      ),
    );
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000a'`,
    );
    await t.test(
      "member creates a vendor and create retries do not duplicate it",
      async () => {
        await saveVendor(null);
        await saveVendor(null);
        const r = await db.query<{ version: number }>(
          "select version from vendors",
        );
        assert.equal(r.rows.length, 1);
        assert.equal(r.rows[0].version, 1);
      },
    );
    await t.test(
      "direct writes and cross-wedding RPC calls are denied",
      async () => {
        await assert.rejects(db.query(`update vendors set agreed_cents=1`));
        await assert.rejects(db.query(`delete from vendors`));
        await assert.rejects(saveVendor(1, 10000, "booked", other));
        await assert.rejects(
          db.query(`select set_wedding_budget($1,1,0)`, [other]),
        );
      },
    );
    await t.test(
      "payments are idempotent, versioned and cannot overallocate agreed price",
      async () => {
        await savePayment(p, 1, null);
        await savePayment(p, 1, null);
        assert.equal((await db.query("select * from payments")).rows.length, 1);
        await assert.rejects(
          savePayment("00000000-0000-0000-0000-000000000022", 2, null, 8001),
        );
        await assert.rejects(
          savePayment("00000000-0000-0000-0000-000000000022", 1, null, 100),
        );
        await savePayment(p, 2, 1, 2000, "2026-01-01");
        const r = await db.query<{ paid_date: Date | string; version: number }>(
          "select paid_date,version from payments",
        );
        assert.ok(r.rows[0].paid_date);
        assert.equal(r.rows[0].version, 2);
        await assert.rejects(db.query(`update payments set amount_cents=100`));
      },
    );
    await t.test(
      "existing records block unsafe vendor price/status changes and deletion",
      async () => {
        await assert.rejects(saveVendor(3, 1999));
        await assert.rejects(saveVendor(3, 10000, "rejected"));
        await assert.rejects(db.query("select delete_vendor($1,3)", [v]));
        await assert.rejects(db.query("select delete_payment($1,3,1)", [p]));
      },
    );
    await t.test(
      "the other partner can read and manage shared records",
      async () => {
        await db.exec(
          `set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000b'`,
        );
        assert.equal((await db.query("select * from vendors")).rows.length, 1);
        await db.query("select delete_payment($1,3,2)", [p]);
        assert.equal((await db.query("select * from payments")).rows.length, 0);
        await saveVendor(4, 0);
        await db.query("select delete_vendor($1,5)", [v]);
        assert.equal((await db.query("select * from vendors")).rows.length, 0);
      },
    );
    await t.test(
      "budget updates check version and cents precision",
      async () => {
        await db.query("select set_wedding_budget($1,1,1234.56)", [w]);
        await assert.rejects(
          db.query("select set_wedding_budget($1,1,999)", [w]),
        );
        await assert.rejects(
          db.query("select set_wedding_budget($1,2,1.001)", [w]),
        );
        const r = await db.query<{
          budget: string | number;
          budget_version: number;
        }>("select budget,budget_version from weddings");
        assert.equal(Number(r.rows[0].budget), 1234.56);
        assert.equal(r.rows[0].budget_version, 2);
      },
    );
    await t.test(
      "unrelated users and anonymous callers cannot access financial rows/functions",
      async () => {
        await db.exec(
          `set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000c'`,
        );
        await assert.rejects(saveVendor(null));
        assert.equal((await db.query("select * from vendors")).rows.length, 0);
        await db.exec("reset role;set role anon");
        await assert.rejects(saveVendor(null));
      },
    );
  } finally {
    await db.close();
  }
});
