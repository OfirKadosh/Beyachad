import { parseMoney } from "./money";
export type Wedding = {
  id: string;
  partner_one: string;
  partner_two: string;
  wedding_date: string | null;
  budget: number | null;
  budget_version?: number;
};
export type Task = {
  id: string;
  wedding_id: string;
  title: string;
  owner: "both" | "one" | "two";
  completed: boolean;
  recommendation_key: string | null;
  version: number;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "normal" | "high";
  category: "general" | "budget" | "venue" | "guests" | "vendors" | "personal";
  due_date: string | null;
  notes: string;
};
export const recommendations = [
  {
    key: "budget",
    title: "להגדיר מסגרת תקציב",
    detail: "מסכימים על סכום כולל ומשאירים מרווח להוצאות לא צפויות.",
  },
  {
    key: "guests",
    title: "להכין רשימת מוזמנים ראשונית",
    detail: "מספר אורחים משוער יעזור לסנן מקומות ולתכנן עלויות.",
  },
  {
    key: "date",
    title: "לבחור תקופה ותאריכים אפשריים",
    detail: "אפשר להתחיל מחודש או עונה, בלי להתחייב לתאריך.",
  },
  {
    key: "venue",
    title: "להשוות אולמות ומקומות",
    detail: "בודקים מה כלול במחיר, זמינות ותנאי ביטול.",
  },
  {
    key: "priorities",
    title: "להחליט מה הכי חשוב לכם",
    detail: "כל אחד בוחר שלושה דברים שחשובים לו ביום החתונה.",
  },
  {
    key: "partner",
    title: "לצרף את בן או בת הזוג",
    detail: "כל אחד עם חשבון משלו, ושניכם עם אותה תמונת מצב.",
  },
] as const;
export function canUseDevSession(
  isDev: boolean,
  environment?: string,
  flag?: string,
) {
  return isDev && environment === "development" && flag === "true";
}
export function parseBudget(value: string): number | null {
  const cents = parseMoney(value);
  return cents === null ? null : cents / 100;
}
export function parseDate(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = new Date(value + "T12:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw Error("יש להזין תאריך תקין בפורמט YYYY-MM-DD.");
  return value;
}
export function validateTitle(value: string) {
  const title = value.trim();
  if (!title || title.length > 160)
    throw Error("שם המשימה צריך להכיל בין 1 ל־160 תווים.");
  return title;
}
export function weddingTitle(wedding: Wedding | null) {
  return wedding?.partner_one && wedding.partner_two
    ? `${wedding.partner_one} ו${wedding.partner_two}`
    : "החתונה שלנו";
}
