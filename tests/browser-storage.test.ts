import { test } from "node:test";
import assert from "node:assert/strict";
import { browserSessionStorage } from "../src/core/browserStorage";

test("browser sessions survive client recreation and sign-out removes them", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  } as Storage;
  await browserSessionStorage(() => storage).setItem("session", "token");
  const restarted = browserSessionStorage(() => storage);
  assert.equal(await restarted.getItem("session"), "token");
  await restarted.removeItem("session");
  assert.equal(
    await browserSessionStorage(() => storage).getItem("session"),
    null,
  );
});
test("no browser global and blocked storage access fall back to memory", async () => {
  for (const resolve of [
    () => null,
    () => {
      throw Error("blocked");
    },
  ]) {
    const storage = browserSessionStorage(resolve);
    await storage.setItem("session", "token");
    assert.equal(await storage.getItem("session"), "token");
    await storage.removeItem("session");
    assert.equal(await storage.getItem("session"), null);
  }
});
test("failed persistent writes are reported instead of claiming saved login", async () => {
  const storage = browserSessionStorage(
    () =>
      ({
        setItem() {
          throw Error("quota");
        },
      }) as unknown as Storage,
  );
  await assert.rejects(storage.setItem("session", "token"), /quota/);
});

test("another tab removing a session cannot resurrect the in-memory token", async () => {
  const values = new Map<string, string>();
  const target = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  } as Storage;
  const firstTab = browserSessionStorage(() => target);
  await firstTab.setItem("session", "token");
  await browserSessionStorage(() => target).removeItem("session");
  assert.equal(await firstTab.getItem("session"), null);
});
