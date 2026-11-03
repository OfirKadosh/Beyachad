import test from "node:test";
import assert from "node:assert/strict";
import type { Task, Wedding } from "../src/core/domain";
import {
  assigneeLabel,
  belongsToMe,
  emptyTask,
  formatDueDate,
  isOverdue,
  localDateKey,
  normalizeTask,
  removeTask,
  replaceTask,
  selectTasks,
  validateTask,
} from "../src/core/tasks";
const task = (id: string, fields: Partial<Task> = {}): Task => ({
  ...emptyTask(),
  id,
  title: id,
  wedding_id: "wedding",
  completed: false,
  recommendation_key: null,
  version: 1,
  ...fields,
});
test("assignments refer to stable wedding slots from both partners viewpoints", () => {
  const mine = task("mine", { owner: "one" });
  const partner = task("partner", { owner: "two" });
  const both = task("both");
  assert.equal(belongsToMe(mine, "one"), true);
  assert.equal(belongsToMe(mine, "two"), false);
  assert.equal(belongsToMe(partner, "two"), true);
  assert.equal(belongsToMe(both, "one"), true);
  assert.equal(belongsToMe(both, "two"), true);
  assert.equal(assigneeLabel("two", null, "two"), "אני");
  assert.equal(assigneeLabel("two", null, "one"), "בן/בת הזוג");
  const wedding = { partner_one: "א", partner_two: "ב" } as Wedding;
  assert.equal(assigneeLabel("one", wedding, "two"), "א");
});
test("local v0.1 tasks migrate without losing completion or ownership", () => {
  const legacy = {
    id: "old",
    title: "ישן",
    wedding_id: "w",
    completed: true,
    owner: "me",
    recommendation_key: "budget",
    version: 3,
  };
  const next = normalizeTask(legacy);
  assert.equal(next.owner, "one");
  assert.equal(next.status, "done");
  assert.equal(next.version, 3);
  assert.equal(next.notes, "");
  assert.equal(next.priority, "normal");
  assert.equal(
    normalizeTask({ ...legacy, owner: "partner", completed: false }).owner,
    "two",
  );
});
test("task validation preserves only editable fields and validates bounds", () => {
  const result = validateTask({
    ...task("hidden"),
    title: "  משימה  ",
    notes: "  טקסט  ",
  });
  assert.equal(result.title, "משימה");
  assert.equal(result.notes, "טקסט");
  assert.ok(!("id" in result));
  assert.ok(!("version" in result));
  assert.ok(!("completed" in result));
  assert.throws(() =>
    validateTask({ ...emptyTask(), title: "x", notes: "a".repeat(2001) }),
  );
  assert.throws(() =>
    validateTask({ ...emptyTask(), title: "x", due_date: "2027-02-29" }),
  );
  assert.throws(() =>
    validateTask({ ...emptyTask(), title: "x", owner: "me" as Task["owner"] }),
  );
});
test("overdue dates use local calendar dates and exclude completed work", () => {
  assert.equal(localDateKey(new Date(2026, 10, 3, 23, 30)), "2026-11-03");
  assert.equal(
    isOverdue(task("x", { due_date: "2026-11-02" }), "2026-11-03"),
    true,
  );
  assert.equal(
    isOverdue(task("x", { due_date: "2026-11-03" }), "2026-11-03"),
    false,
  );
  assert.equal(
    isOverdue(
      task("x", { due_date: "2026-11-02", status: "done", completed: true }),
      "2026-11-03",
    ),
    false,
  );
  assert.equal(formatDueDate("2027-01-09"), "09.01.2027");
});
test("combined filters and sorting do not mutate the shared task list", () => {
  const tasks = [
    task("later", { due_date: "2027-01-02", priority: "high", notes: "חוזה" }),
    task("soon", { due_date: "2027-01-01", owner: "two", category: "venue" }),
    task("no-date"),
    task("done", { status: "done", completed: true, due_date: "2020-01-01" }),
  ];
  const options = {
    filter: "open" as const,
    query: "",
    sort: "due" as const,
    viewer: "one" as const,
  };
  assert.deepEqual(
    selectTasks(tasks, options).map((t) => t.id),
    ["soon", "later", "no-date"],
  );
  assert.deepEqual(
    selectTasks(tasks, { ...options, sort: "priority" }).map((t) => t.id),
    ["later", "soon", "no-date"],
  );
  assert.deepEqual(
    selectTasks(tasks, { ...options, filter: "mine", category: "venue" }),
    [],
  );
  assert.deepEqual(
    selectTasks(tasks, { ...options, query: "חוזה" }).map((t) => t.id),
    ["later"],
  );
  assert.deepEqual(
    tasks.map((t) => t.id),
    ["later", "soon", "no-date", "done"],
  );
});
test("versioned editing and deletion reject stale or removed tasks", () => {
  const original = task("one");
  const updated = replaceTask([original], original, {
    ...original,
    status: "done",
  });
  assert.equal(updated[0].version, 2);
  assert.equal(updated[0].completed, true);
  assert.equal(original.version, 1);
  assert.equal(original.completed, false);
  assert.throws(() =>
    replaceTask(updated, original, { ...original, title: "stale" }),
  );
  assert.throws(() => removeTask(updated, original));
  assert.throws(() => removeTask([], original));
  assert.deepEqual(removeTask(updated, updated[0]), []);
});
