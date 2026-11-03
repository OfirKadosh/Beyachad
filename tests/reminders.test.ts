import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReminders,
  createReminderSync,
  futureNotifications,
  REMINDER_LIMIT,
  type ReminderAdapter,
  type ReminderItem,
  type ScheduledReminder,
} from "../src/core/reminders";
import type { Meeting } from "../src/core/meetings";
import { emptyTask } from "../src/core/tasks";
const item = (key: string, at: number): ReminderItem => ({
  key,
  kind: "meeting",
  title: "private title",
  eventAt: at + 60000,
  notifyAt: at,
  href: { pathname: "/meetings" },
});
function fake() {
  let rows: ScheduledReminder[] = [];
  let prompts = 0,
    schedules = 0,
    allowed = true;
  const adapter: ReminderAdapter = {
    supported: true,
    permission: async (request) => {
      if (request) prompts++;
      return allowed;
    },
    list: async () => [...rows],
    cancel: async (id) => {
      rows = rows.filter((r) => r.id !== id);
    },
    schedule: async (owner, i) => {
      schedules++;
      rows.push({
        id: `${owner}-${i.key}`,
        owner,
        key: i.key,
        at: i.notifyAt!,
      });
    },
  };
  return {
    adapter,
    get rows() {
      return rows;
    },
    get schedules() {
      return schedules;
    },
    get prompts() {
      return prompts;
    },
    deny() {
      allowed = false;
    },
  };
}
test("agenda includes personal/shared active sources and excludes completed/cancelled records", () => {
  const meeting: Meeting = {
    id: "m",
    wedding_id: "w",
    version: 1,
    title: "x",
    starts_at: "2027-01-04T10:00:00.000Z",
    time_zone: "UTC",
    duration_minutes: 60,
    location: "",
    vendor_id: null,
    owner: "two",
    status: "scheduled",
    reminder_minutes: 60,
    notes: "",
  };
  const task = {
    ...emptyTask(),
    id: "t",
    wedding_id: "w",
    version: 1,
    title: "task",
    completed: false,
    recommendation_key: null,
    due_date: "2027-01-04",
  };
  const payment = {
    id: "p",
    vendor_id: "v",
    wedding_id: "w",
    version: 1,
    label: "payment",
    amount_cents: 100,
    due_date: "2027-01-04",
    paid_date: null,
  };
  const list = buildReminders(
    [meeting],
    [task],
    [payment],
    "one",
    "Asia/Jerusalem",
  );
  assert.deepEqual(
    list.map((i) => i.kind),
    ["payment", "task"],
  );
  assert.equal(
    new Date(list[0].notifyAt!).toISOString(),
    "2027-01-04T07:00:00.000Z",
  );
  assert.equal(
    buildReminders(
      [{ ...meeting, status: "cancelled" }],
      [{ ...task, status: "done", completed: true }],
      [{ ...payment, paid_date: "2027-01-03" }],
      "two",
      "UTC",
    ).length,
    0,
  );
  assert.equal(
    buildReminders([meeting], [], [], "two", "UTC")[0].notifyAt,
    Date.parse(meeting.starts_at) - 3600000,
  );
});
test("only the closest future reminders are scheduled, never past or disabled meetings", () => {
  const rows = Array.from({ length: 70 }, (_, i) => item(String(i), 1000 + i));
  rows.push({ ...item("off", 2000), notifyAt: null }, item("past", 0));
  const result = futureNotifications(rows, 999);
  assert.equal(result.length, REMINDER_LIMIT);
  assert.equal(result[0].key, "0");
  assert.equal(result.at(-1)?.key, "49");
});
test("reconciliation keeps unchanged alarms, replaces dates and cancels removed/completed sources", async () => {
  const f = fake(),
    engine = createReminderSync(f.adapter);
  await engine.sync("a", [item("m", 2000)], true, 1000);
  await engine.sync("a", [item("m", 2000)], true, 1000);
  assert.equal(f.schedules, 1);
  assert.equal(f.prompts, 0);
  await engine.sync("a", [item("m", 3000)], true, 1000);
  assert.equal(f.rows.length, 1);
  assert.equal(f.rows[0].at, 3000);
  await engine.sync("a", [], true, 1000);
  assert.equal(f.rows.length, 0);
});
test("account change, permission revocation and disable clear previous managed alarms", async () => {
  const f = fake(),
    engine = createReminderSync(f.adapter);
  await engine.sync("a", [item("a", 2000)], true, 1000);
  await engine.sync("b", [item("b", 3000)], true, 1000);
  assert.deepEqual(
    f.rows.map((r) => r.owner),
    ["b"],
  );
  f.deny();
  assert.equal(
    (await engine.sync("b", [item("b", 3000)], true, 1000)).status,
    "denied",
  );
  assert.equal(f.rows.length, 0);
  await engine.clear();
});
test("sign-out invalidates an in-flight reconciliation before it can schedule", async () => {
  let release!: () => void;
  const pending = new Promise<void>((r) => {
    release = r;
  });
  const f = fake();
  f.adapter.permission = async () => {
    await pending;
    return true;
  };
  const engine = createReminderSync(f.adapter);
  const sync = engine.sync("old", [item("m", 2000)], true, 1000);
  await Promise.resolve();
  const clear = engine.clear();
  release();
  await Promise.all([sync, clear]);
  assert.equal(f.rows.length, 0);
});
test("unsupported browser adapter never requests permission or schedules alarms", async () => {
  const f = fake();
  f.adapter.supported = false;
  const result = await createReminderSync(f.adapter).sync(
    "x",
    [item("m", 2000)],
    true,
    1000,
  );
  assert.equal(result.status, "unsupported");
  assert.equal(f.schedules, 0);
  assert.equal(f.prompts, 0);
});
