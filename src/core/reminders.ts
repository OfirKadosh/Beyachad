import type { Meeting } from "./meetings";
import type { Task } from "./domain";
import type { Payment } from "./finance";
import { wallTimeToInstant } from "./meetingTime";
import { belongsToMe, type MemberSlot } from "./tasks";
export type ReminderItem = {
  key: string;
  kind: "meeting" | "task" | "payment";
  title: string;
  eventAt: number;
  notifyAt: number | null;
  href: { pathname: string; params?: Record<string, string> };
};
export function buildReminders(
  meetings: Meeting[],
  tasks: Task[],
  payments: Payment[],
  viewer: MemberSlot,
  zone: string,
): ReminderItem[] {
  const items: ReminderItem[] = [];
  for (const m of meetings)
    if (
      m.status === "scheduled" &&
      (m.owner === "both" || m.owner === viewer)
    ) {
      const at = Date.parse(m.starts_at);
      items.push({
        key: `meeting:${m.id}`,
        kind: "meeting",
        title: m.title,
        eventAt: at,
        notifyAt:
          m.reminder_minutes === null ? null : at - m.reminder_minutes * 60000,
        href: { pathname: "/meeting-editor", params: { id: m.id } },
      });
    }
  for (const t of tasks)
    if (t.status !== "done" && t.due_date && belongsToMe(t, viewer))
      items.push({
        key: `task:${t.id}`,
        kind: "task",
        title: t.title,
        eventAt: Date.parse(wallTimeToInstant(t.due_date, "23:59", zone)),
        notifyAt: Date.parse(wallTimeToInstant(t.due_date, "09:00", zone)),
        href: { pathname: "/task-editor", params: { id: t.id } },
      });
  for (const p of payments)
    if (!p.paid_date && p.due_date)
      items.push({
        key: `payment:${p.id}`,
        kind: "payment",
        title: p.label,
        eventAt: Date.parse(wallTimeToInstant(p.due_date, "23:59", zone)),
        notifyAt: Date.parse(wallTimeToInstant(p.due_date, "09:00", zone)),
        href: {
          pathname: "/payment-editor",
          params: { id: p.id, vendorId: p.vendor_id },
        },
      });
  return items.sort(
    (a, b) => a.eventAt - b.eventAt || a.key.localeCompare(b.key),
  );
}
export const REMINDER_LIMIT = 50;
export function futureNotifications(items: ReminderItem[], now = Date.now()) {
  return items
    .filter((i) => i.notifyAt !== null && i.notifyAt > now)
    .sort((a, b) => a.notifyAt! - b.notifyAt! || a.key.localeCompare(b.key))
    .slice(0, REMINDER_LIMIT);
}
export const notificationTitles = {
  meeting: "ביחד · תזכורת לפגישה",
  task: "ביחד · תזכורת למשימה",
  payment: "ביחד · תזכורת לתשלום",
};
export type ScheduledReminder = {
  id: string;
  owner: string;
  key: string;
  at: number;
};
export interface ReminderAdapter {
  supported: boolean;
  permission(request?: boolean): Promise<boolean>;
  list(): Promise<ScheduledReminder[]>;
  cancel(id: string): Promise<void>;
  schedule(owner: string, item: ReminderItem): Promise<void>;
}
export function createReminderSync(adapter: ReminderAdapter) {
  let generation = 0;
  let queue: Promise<unknown> = Promise.resolve();
  function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = queue.then(fn, fn);
    queue = next.catch(() => {});
    return next;
  }
  return {
    sync(
      owner: string,
      items: ReminderItem[],
      enabled: boolean,
      now = Date.now(),
    ) {
      const request = ++generation;
      return enqueue(async () => {
        if (!adapter.supported)
          return { count: 0, status: "unsupported" as const };
        if (request !== generation)
          return { count: 0, status: "superseded" as const };
        const allowed = enabled && (await adapter.permission());
        const desired = allowed ? futureNotifications(items, now) : [];
        const existing = await adapter.list();
        if (request !== generation)
          return { count: 0, status: "superseded" as const };
        const wanted = new Map(desired.map((i) => [i.key, i]));
        const retained = new Set<string>();
        for (const old of existing) {
          if (request !== generation)
            return { count: 0, status: "superseded" as const };
          const item = wanted.get(old.key);
          if (
            old.owner !== owner ||
            !item ||
            old.at !== item.notifyAt ||
            retained.has(old.key)
          )
            await adapter.cancel(old.id);
          else retained.add(old.key);
        }
        for (const item of desired) {
          if (request !== generation)
            return { count: 0, status: "superseded" as const };
          if (!retained.has(item.key)) await adapter.schedule(owner, item);
        }
        return {
          count: desired.length,
          status: !enabled
            ? ("disabled" as const)
            : allowed
              ? ("ready" as const)
              : ("denied" as const),
        };
      });
    },
    clear() {
      ++generation;
      return enqueue(async () => {
        if (adapter.supported)
          for (const item of await adapter.list())
            await adapter.cancel(item.id);
      });
    },
  };
}
