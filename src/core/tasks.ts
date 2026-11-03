import { parseDate, validateTitle, type Task, type Wedding } from "./domain";

export type MemberSlot = "one" | "two";
export type TaskDraft = Pick<
  Task,
  "title" | "owner" | "status" | "priority" | "category" | "due_date" | "notes"
>;
export const statusLabels = {
  todo: "לביצוע",
  in_progress: "בטיפול",
  done: "הושלם",
} as const;
export const priorityLabels = {
  low: "נמוכה",
  normal: "רגילה",
  high: "גבוהה",
} as const;
export const categoryLabels = {
  general: "כללי",
  budget: "תקציב",
  venue: "אולם",
  guests: "מוזמנים",
  vendors: "ספקים",
  personal: "אישי",
} as const;
export function emptyTask(): TaskDraft {
  return {
    title: "",
    owner: "both",
    status: "todo",
    priority: "normal",
    category: "general",
    due_date: null,
    notes: "",
  };
}
export function normalizeTask(
  raw: Omit<Partial<Task>, "owner"> & { owner?: string; completed?: boolean },
): Task {
  return {
    ...emptyTask(),
    ...raw,
    owner:
      raw.owner === "me"
        ? "one"
        : raw.owner === "partner"
          ? "two"
          : (raw.owner ?? "both"),
    status: raw.status ?? (raw.completed ? "done" : "todo"),
  } as Task;
}
export function validateTask(input: TaskDraft): TaskDraft {
  if (
    !["both", "one", "two"].includes(input.owner) ||
    !Object.hasOwn(statusLabels, input.status) ||
    !Object.hasOwn(priorityLabels, input.priority) ||
    !Object.hasOwn(categoryLabels, input.category)
  )
    throw Error("יש לבחור אחראי, מצב, עדיפות וקטגוריה תקינים.");
  if (input.notes.length > 2000)
    throw Error("הערות יכולות להכיל עד 2,000 תווים.");
  return {
    title: validateTitle(input.title),
    owner: input.owner,
    status: input.status,
    priority: input.priority,
    category: input.category,
    notes: input.notes.trim(),
    due_date: parseDate(input.due_date ?? ""),
  };
}
export function assigneeLabel(
  owner: Task["owner"],
  wedding: Wedding | null,
  viewer: MemberSlot,
) {
  if (owner === "both") return "שנינו";
  return (
    (owner === "one" ? wedding?.partner_one : wedding?.partner_two) ||
    (owner === viewer ? "אני" : "בן/בת הזוג")
  );
}
export function belongsToMe(task: Task, viewer: MemberSlot) {
  return task.owner === "both" || task.owner === viewer;
}
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function isOverdue(task: Task, today = localDateKey()) {
  return task.status !== "done" && !!task.due_date && task.due_date < today;
}
export function formatDueDate(date: string | null) {
  if (!date) return "ללא תאריך";
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}
export type TaskFilter = "all" | "mine" | "open" | "done";
export type TaskSort = "due" | "priority";
export function selectTasks(
  tasks: Task[],
  options: {
    filter: TaskFilter;
    query: string;
    sort: TaskSort;
    viewer: MemberSlot;
    category?: Task["category"] | "all";
  },
) {
  const rank = { high: 0, normal: 1, low: 2 };
  const query = options.query.trim().toLocaleLowerCase();
  return tasks
    .filter(
      (t) =>
        (options.filter !== "mine" || belongsToMe(t, options.viewer)) &&
        (options.filter !== "open" || t.status !== "done") &&
        (options.filter !== "done" || t.status === "done") &&
        (!options.category ||
          options.category === "all" ||
          t.category === options.category) &&
        (!query || `${t.title} ${t.notes}`.toLocaleLowerCase().includes(query)),
    )
    .sort((a, b) => {
      const state = Number(a.status === "done") - Number(b.status === "done");
      const date = (a.due_date ?? "9999-12-31").localeCompare(
        b.due_date ?? "9999-12-31",
      );
      const priority = rank[a.priority] - rank[b.priority];
      return (
        state ||
        (options.sort === "priority" ? priority || date : date || priority) ||
        a.id.localeCompare(b.id)
      );
    });
}
export const conflictMessage =
  "המשימה השתנתה או נמחקה ממכשיר אחר. הרשימה רועננה. חזרו לרשימה ופתחו אותה מחדש לפני שינוי נוסף.";
export function replaceTask(
  tasks: Task[],
  original: Task,
  draft: TaskDraft,
): Task[] {
  const current = tasks.find((t) => t.id === original.id);
  if (!current || current.version !== original.version)
    throw Error(conflictMessage);
  return tasks.map((t) =>
    t.id === original.id
      ? {
          ...t,
          ...validateTask(draft),
          completed: draft.status === "done",
          version: t.version + 1,
        }
      : t,
  );
}
export function removeTask(tasks: Task[], original: Task): Task[] {
  const current = tasks.find((t) => t.id === original.id);
  if (!current || current.version !== original.version)
    throw Error(conflictMessage);
  return tasks.filter((t) => t.id !== original.id);
}
