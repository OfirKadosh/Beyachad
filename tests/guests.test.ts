import test from "node:test";
import assert from "node:assert/strict";
import {
  deleteGuestState,
  duplicatePhone,
  emptyGuest,
  guestSideLabel,
  guestTotals,
  parseCount,
  saveGuestState,
  selectGuests,
  validateGuest,
  type GuestInvitation,
} from "../src/core/guests";
import { loadGuestPages } from "../src/core/guestPages";
const guest = (
  id: string,
  input: Partial<GuestInvitation> = {},
): GuestInvitation => ({
  ...emptyGuest(),
  id,
  wedding_id: "w",
  version: 1,
  name: id,
  ...input,
});
test("invitation and person totals reconcile with partial family confirmations", () => {
  const list = [
    guest("family", {
      invited_adults: 3,
      invited_children: 2,
      rsvp: "confirmed",
      confirmed_adults: 2,
      confirmed_children: 1,
    }),
    guest("pending", { invited_adults: 2, invited_children: 1 }),
    guest("no", { rsvp: "declined", invited_adults: 2 }),
  ];
  const totals = guestTotals(list);
  assert.equal(totals.invitations, 3);
  assert.equal(totals.invited, 10);
  assert.equal(totals.confirmed, 3);
  assert.equal(totals.pending, 3);
  assert.equal(totals.declined, 4);
  assert.equal(
    totals.confirmed + totals.pending + totals.declined,
    totals.invited,
  );
  assert.equal(totals.confirmed_children, 1);
});
test("counts and RSVP constraints reject impossible families without coercion", () => {
  for (const value of ["-1", "1.5", "1e2", "101", ""])
    assert.throws(() => parseCount(value));
  assert.equal(parseCount("0"), 0);
  assert.throws(() =>
    validateGuest({ ...emptyGuest(), name: "x", invited_adults: 0 }),
  );
  assert.throws(() =>
    validateGuest({
      ...emptyGuest(),
      name: "x",
      invited_adults: 100,
      invited_children: 1,
    }),
  );
  assert.throws(() =>
    validateGuest({ ...emptyGuest(), name: "x", rsvp: "confirmed" }),
  );
  assert.throws(() =>
    validateGuest({ ...emptyGuest(), name: "x", confirmed_adults: 1 }),
  );
  assert.throws(() =>
    validateGuest({
      ...emptyGuest(),
      name: "x",
      rsvp: "confirmed",
      confirmed_children: 1,
    }),
  );
  assert.throws(() =>
    validateGuest({
      ...emptyGuest(),
      name: "x",
      rsvp: "declined",
      confirmed_adults: 1,
    }),
  );
  const valid = validateGuest({ ...guest("hidden"), name: "  משפחה  " });
  assert.equal(valid.name, "משפחה");
  assert.ok(!("id" in valid));
  assert.ok(!("version" in valid));
});
test("children-only invitations and partial child confirmations are supported", () => {
  const row = validateGuest({
    ...emptyGuest(),
    name: "children",
    invited_adults: 0,
    invited_children: 2,
    rsvp: "confirmed",
    confirmed_children: 1,
  });
  assert.equal(row.confirmed_children, 1);
  assert.equal(guestTotals([guest("x", row)]).declined, 1);
});
test("side identity stays stable between partners, groups and dietary text are searchable", () => {
  const rows = [
    guest("א", { side: "one", group_name: "משפחה", dietary: "ללא גלוטן" }),
    guest("ב", { side: "two", rsvp: "declined" }),
    guest("ג", { side: "shared", phone: "0501234567" }),
  ];
  assert.equal(guestSideLabel("one", null, "one"), "הצד שלי");
  assert.equal(guestSideLabel("one", null, "two"), "הצד של בן/בת הזוג");
  assert.deepEqual(
    selectGuests(rows, {
      query: "גלוטן",
      rsvp: "all",
      side: "one",
      group: "משפחה",
    }).map((g) => g.id),
    ["א"],
  );
  assert.deepEqual(
    selectGuests(rows, { query: "", rsvp: "declined", side: "two" }).map(
      (g) => g.id,
    ),
    ["ב"],
  );
  assert.equal(duplicatePhone(rows, "050-123-4567"), true);
  assert.equal(duplicatePhone(rows, "0501234567", "ג"), false);
  assert.equal(duplicatePhone(rows, ""), false);
});
test("guest creates are idempotent and stale edits/deletes preserve current data", () => {
  const rows = saveGuestState([], "g", "w", null, {
    ...emptyGuest(),
    name: "משפחה",
  });
  assert.equal(
    saveGuestState(rows, "g", "w", null, { ...emptyGuest(), name: "משפחה" }),
    rows,
  );
  const next = saveGuestState(rows, "g", "w", 1, {
    ...rows[0],
    rsvp: "confirmed",
    confirmed_adults: 1,
  });
  assert.equal(next[0].version, 2);
  assert.equal(rows[0].rsvp, "pending");
  assert.throws(() => saveGuestState(next, "g", "w", 1, rows[0]));
  assert.throws(() => saveGuestState(next, "g", "other", 2, next[0]));
  assert.throws(() => deleteGuestState(next, rows[0]));
  assert.deepEqual(deleteGuestState(next, next[0]), []);
});
test("paged guest loading handles server caps and rejects incomplete pages", async () => {
  const rows = Array.from({ length: 1201 }, (_, i) => guest(String(i)));
  let requests = 0;
  const result = await loadGuestPages(async (from) => {
    requests++;
    return { rows: rows.slice(from, from + 100), count: rows.length };
  });
  assert.equal(result.length, 1201);
  assert.equal(requests, 13);
  await assert.rejects(loadGuestPages(async () => ({ rows: [], count: 5 })));
});
