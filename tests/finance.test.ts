import test from "node:test";
import assert from "node:assert/strict";
import {
  budgetTotals,
  deletePaymentState,
  deleteVendorState,
  emptyVendor,
  savePaymentState,
  saveVendorState,
  validatePayment,
  validateVendor,
  vendorTotals,
  type FinanceState,
  type Vendor,
  type Payment,
} from "../src/core/finance";
import { moneyInput, parseMoney } from "../src/core/money";
const vendor = (overrides: Partial<Vendor> = {}): Vendor => ({
  ...emptyVendor(),
  name: "אולם",
  status: "booked",
  agreed_cents: 10000,
  id: "v",
  wedding_id: "w",
  version: 1,
  ...overrides,
});
const payment = (overrides: Partial<Payment> = {}): Payment => ({
  id: "p",
  vendor_id: "v",
  wedding_id: "w",
  label: "מקדמה",
  amount_cents: 2000,
  due_date: null,
  paid_date: "2026-01-01",
  version: 1,
  ...overrides,
});
test("money parsing uses integer cents, distinguishes blank/zero and rejects sub-cent inputs", () => {
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney("0"), 0);
  assert.equal(parseMoney("1,234.56"), 123456);
  assert.equal(parseMoney("0.10")! + parseMoney("0.20")!, 30);
  assert.equal(moneyInput(29), "0.29");
  for (const value of [
    "-1",
    "1,2",
    "1.001",
    "1e3",
    "Infinity",
    "NaN",
    "1000000000.01",
  ])
    assert.throws(() => parseMoney(value));
  assert.throws(() => parseMoney("", true));
});
test("budget totals exclude quotes and avoid double counting planned payments", () => {
  const s: FinanceState = {
    vendors: [
      vendor(),
      vendor({
        id: "quote",
        status: "quoted",
        quote_cents: 999999,
        agreed_cents: null,
      }),
    ],
    payments: [
      payment(),
      payment({
        id: "planned",
        amount_cents: 3000,
        paid_date: null,
        due_date: "2026-01-02",
      }),
    ],
  };
  assert.deepEqual(vendorTotals(s.vendors[0], s.payments), {
    committed: 10000,
    paid: 2000,
    scheduled: 3000,
    remaining: 8000,
    unscheduled: 5000,
  });
  assert.deepEqual(budgetTotals(s, 9000, "2026-01-03"), {
    committed: 10000,
    paid: 2000,
    scheduled: 3000,
    remaining: 8000,
    available: -1000,
    overdue: 1,
  });
  assert.equal(budgetTotals(s, null).available, null);
});
test("vendor and payment fields validate stable enums, positive payments and dates", () => {
  assert.throws(() =>
    validateVendor({ ...emptyVendor(), name: "x", status: "booked" }),
  );
  assert.equal(
    validateVendor({
      ...emptyVendor(),
      name: " free ",
      status: "booked",
      agreed_cents: 0,
    }).name,
    "free",
  );
  assert.throws(() => validatePayment({ ...payment(), amount_cents: 0 }));
  assert.throws(() =>
    validatePayment({ ...payment(), paid_date: null, due_date: null }),
  );
  assert.throws(() =>
    validatePayment({ ...payment(), paid_date: "2026-02-30" }),
  );
});
test("planned-to-paid changes reuse one record and stale payment edits/deletes fail", () => {
  const v = vendor();
  const initial: FinanceState = { vendors: [v], payments: [] };
  const draft = { ...payment(), paid_date: null, due_date: "2026-01-02" };
  const created = savePaymentState(initial, v, "p", null, draft);
  assert.equal(created.vendors[0].version, 2);
  const retried = savePaymentState(created, v, "p", null, draft);
  assert.equal(retried, created);
  assert.equal(retried.payments.length, 1);
  const changed = savePaymentState(created, created.vendors[0], "p", 1, {
    ...draft,
    paid_date: "2026-01-02",
  });
  assert.equal(changed.payments.length, 1);
  assert.equal(vendorTotals(v, changed.payments).paid, 2000);
  assert.throws(() =>
    savePaymentState(changed, created.vendors[0], "p", 1, draft),
  );
  assert.throws(() =>
    deletePaymentState(changed, created.vendors[0], created.payments[0]),
  );
  assert.equal(
    deletePaymentState(changed, changed.vendors[0], changed.payments[0])
      .payments.length,
    0,
  );
});
test("payment allocation, price reductions and deletion protect existing payment records", () => {
  const v = vendor();
  const s: FinanceState = {
    vendors: [v],
    payments: [payment({ amount_cents: 8000 })],
  };
  assert.throws(() =>
    savePaymentState(s, v, "p2", null, { ...payment(), amount_cents: 2001 }),
  );
  assert.throws(() =>
    saveVendorState(s, "v", "w", 1, { ...v, agreed_cents: 7999 }),
  );
  assert.throws(() =>
    saveVendorState(s, "v", "w", 1, { ...v, status: "rejected" }),
  );
  assert.throws(() => deleteVendorState(s, v));
  assert.throws(() =>
    savePaymentState(
      { vendors: [vendor({ status: "quoted" })], payments: [] },
      vendor({ status: "quoted" }),
      "p",
      null,
      payment(),
    ),
  );
});
test("vendor create retries are idempotent and editing does not mutate snapshots", () => {
  const s = saveVendorState(
    { vendors: [], payments: [] },
    "v",
    "w",
    null,
    vendor(),
  );
  assert.equal(saveVendorState(s, "v", "w", null, vendor()), s);
  const next = saveVendorState(s, "v", "w", 1, { ...vendor(), name: "שם חדש" });
  assert.equal(s.vendors[0].name, "אולם");
  assert.equal(next.vendors[0].version, 2);
  assert.throws(() => saveVendorState(next, "v", "w", 1, vendor()));
});
