import test from "node:test";
import assert from "node:assert/strict";
import {
  canUseDevSession,
  parseBudget,
  parseDate,
  recommendations,
  validateTitle,
  weddingTitle,
} from "../src/core/domain";
import { sessionStorage, type KV } from "../src/core/chunkStorage";
test("release builds can never enable the development bypass", () => {
  for (const env of ["development", "preview", "production", undefined])
    for (const flag of ["true", "false", undefined])
      assert.equal(canUseDevSession(false, env, flag), false);
  assert.equal(canUseDevSession(true, "production", "true"), false);
  assert.equal(canUseDevSession(true, "preview", "true"), false);
  assert.equal(canUseDevSession(true, "development", "true"), true);
});
test("setup starts with no personal names and permits unknown date/budget", () => {
  assert.equal(weddingTitle(null), "החתונה שלנו");
  assert.equal(parseBudget(""), null);
  assert.equal(parseDate(""), null);
  assert.equal(parseBudget("150,000"), 150000);
  assert.equal(parseBudget("0"), 0);
  for (const v of ["-1", "NaN", "Infinity", "1000000001"])
    assert.throws(() => parseBudget(v));
  assert.equal(parseDate("2028-02-29"), "2028-02-29");
  for (const v of ["2027-02-29", "2027-02-30", "2027-13-01", "01/01/2027"])
    assert.throws(() => parseDate(v));
});
test("recommendations have stable unique identifiers and valid titles", () => {
  assert.equal(
    new Set(recommendations.map((r) => r.key)).size,
    recommendations.length,
  );
  recommendations.forEach((r) => assert.equal(validateTitle(r.title), r.title));
  assert.throws(() => validateTitle("   "));
  assert.throws(() => validateTitle("a".repeat(161)));
});
function memory() {
  const data = new Map<string, string>();
  const store: KV = {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
  };
  return { data, store };
}
test("secure session chunks handle large Hebrew metadata, replacement and logout", async () => {
  const { store, data } = memory();
  const storage = sessionStorage(store);
  const token = JSON.stringify({
    access_token: "a".repeat(4000),
    user: { name: "שלום".repeat(1000) },
  });
  await storage.setItem("session", token);
  assert.equal(await storage.getItem("session"), token);
  for (const v of data.values()) assert.ok(Buffer.byteLength(v) <= 1500);
  await storage.setItem("session", "new");
  assert.equal(await storage.getItem("session"), "new");
  assert.equal(data.size, 2);
  await storage.removeItem("session");
  assert.equal(await storage.getItem("session"), null);
  assert.equal(data.size, 0);
});
test("an interrupted write preserves the previous session", async () => {
  const { store } = memory();
  let fail = false;
  const storage = sessionStorage({
    ...store,
    setItem: async (k, v) => {
      if (fail && k !== "session") throw Error("device storage failure");
      await store.setItem(k, v);
    },
  });
  await storage.setItem("session", "old");
  fail = true;
  await assert.rejects(storage.setItem("session", "new"));
  assert.equal(await storage.getItem("session"), "old");
});
test("concurrent refresh/logout operations are serialized", async () => {
  const { store } = memory();
  const storage = sessionStorage(store);
  await Promise.all([
    storage.setItem("session", "one"),
    storage.setItem("session", "two"),
    storage.removeItem("session"),
  ]);
  assert.equal(await storage.getItem("session"), null);
});
