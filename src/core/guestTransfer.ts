import {
  emptyGuest,
  validateGuest,
  type GuestDraft,
  type GuestInvitation,
} from "./guests";

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const guestColumns: {
  key: keyof GuestDraft;
  label: string;
  aliases: string[];
}[] = [
  {
    key: "name",
    label: "שם להזמנה",
    aliases: ["שם", "name", "guest name", "invitation"],
  },
  { key: "contact", label: "איש קשר", aliases: ["contact"] },
  { key: "phone", label: "טלפון", aliases: ["phone", "mobile", "מספר טלפון"] },
  { key: "side", label: "צד", aliases: ["side"] },
  { key: "group_name", label: "קבוצה", aliases: ["group", "group_name"] },
  {
    key: "invited_adults",
    label: "מבוגרים מוזמנים",
    aliases: ["invited_adults", "adults", "מבוגרים"],
  },
  {
    key: "invited_children",
    label: "ילדים מוזמנים",
    aliases: ["invited_children", "children", "ילדים"],
  },
  { key: "rsvp", label: "מצב הגעה", aliases: ["rsvp", "status", "אישור הגעה"] },
  {
    key: "confirmed_adults",
    label: "מבוגרים אישרו",
    aliases: ["confirmed_adults"],
  },
  {
    key: "confirmed_children",
    label: "ילדים אישרו",
    aliases: ["confirmed_children"],
  },
  { key: "dietary", label: "צרכים תזונתיים", aliases: ["dietary"] },
  { key: "notes", label: "הערות", aliases: ["notes"] },
];
export type GuestTable = {
  headers: string[];
  rows: string[][];
  formulaRows: number[];
};
export type ColumnMapping = Partial<Record<keyof GuestDraft, number>>;
export type ImportPreview = {
  row: number;
  draft: GuestDraft | null;
  error: string;
  duplicate: string;
};
const normalized = (s: string) =>
  s
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s_]+/g, " ");
export function guessGuestMapping(headers: string[]): ColumnMapping {
  const result: ColumnMapping = {};
  for (const col of guestColumns) {
    const index = headers.findIndex((h) =>
      [col.key, col.label, ...col.aliases].some(
        (a) => normalized(a) === normalized(h),
      ),
    );
    if (index >= 0) result[col.key] = index;
  }
  return result;
}
function phoneKey(s: string) {
  let digits = s.replace(/\D/g, "");
  if (digits.startsWith("00972")) digits = "0" + digits.slice(5);
  else if (digits.startsWith("972")) digits = "0" + digits.slice(3);
  return digits.length >= 7 ? digits : "";
}
export function guestDuplicate(
  draft: GuestDraft,
  existing: GuestDraft[],
): string {
  const phone = phoneKey(draft.phone);
  if (phone && existing.some((g) => phoneKey(g.phone) === phone))
    return "מספר הטלפון כבר מופיע ברשימה";
  if (
    existing.some(
      (g) =>
        normalized(g.name) === normalized(draft.name) && g.side === draft.side,
    )
  )
    return "שם ההזמנה והצד כבר מופיעים ברשימה";
  return "";
}
export function previewGuestImport(
  table: GuestTable,
  mapping: ColumnMapping,
  existing: GuestDraft[],
): ImportPreview[] {
  if (mapping.name === undefined) throw Error("יש לבחור עמודה עבור שם להזמנה.");
  const indices = Object.values(mapping);
  if (new Set(indices).size !== indices.length)
    throw Error("אין לשייך אותה עמודה ליותר משדה אחד.");
  if (
    indices.some(
      (i) => !Number.isInteger(i) || i < 0 || i >= table.headers.length,
    )
  )
    throw Error("בחירת העמודות אינה תקינה.");
  if (table.rows.length > MAX_IMPORT_ROWS)
    throw Error(`ניתן לייבא עד ${MAX_IMPORT_ROWS} הזמנות בקובץ אחד.`);
  const seen = [...existing];
  return table.rows.map((row, index) => {
    let draft: GuestDraft | null = null,
      error = "",
      duplicate = "";
    try {
      if (table.formulaRows.includes(index))
        throw Error("השורה מכילה נוסחה. יש להמיר לערכים לפני הייבוא.");
      const input = emptyGuest();
      const value = (key: keyof GuestDraft) =>
        mapping[key] === undefined ? "" : (row[mapping[key]!] ?? "").trim();
      for (const key of [
        "name",
        "contact",
        "phone",
        "group_name",
        "dietary",
        "notes",
      ] as const)
        input[key] = value(key);
      for (const key of [
        "invited_adults",
        "invited_children",
        "confirmed_adults",
        "confirmed_children",
      ] as const) {
        const v = value(key);
        if (v !== "") {
          if (!/^\d+$/.test(v))
            throw Error("כמויות חייבות להיות מספרים שלמים מאפס ועד 100.");
          input[key] = Number(v);
        }
      }
      const side = normalized(value("side"));
      const sides: Record<string, GuestDraft["side"]> = {
        one: "one",
        two: "two",
        shared: "shared",
        "צד 1": "one",
        "צד 2": "two",
        משותף: "shared",
        "1": "one",
        "2": "two",
      };
      if (side) {
        if (!sides[side])
          throw Error("צד לא מוכר. השתמשו בצד 1, צד 2 או משותף.");
        input.side = sides[side];
      }
      const rsvp = normalized(value("rsvp"));
      const states: Record<string, GuestDraft["rsvp"]> = {
        pending: "pending",
        confirmed: "confirmed",
        declined: "declined",
        "טרם השיבו": "pending",
        מגיעים: "confirmed",
        "לא מגיעים": "declined",
      };
      if (rsvp) {
        if (!states[rsvp]) throw Error("מצב הגעה לא מוכר.");
        input.rsvp = states[rsvp];
      }
      draft = validateGuest(input);
      duplicate = guestDuplicate(draft, seen);
      seen.push(draft);
    } catch (e) {
      error = e instanceof Error ? e.message : "שורה לא תקינה";
    }
    return { row: index + 2, draft, error, duplicate };
  });
}
export type ImportEntry = { id: string; draft: GuestDraft };
export type ImportResult = {
  id: string;
  state: "saved" | "duplicate";
  message: string;
};
// One acknowledged write at a time. Stop on first error; stable IDs make an
// uncertain network result safe to retry with the existing save_guest RPC.
export async function runGuestImport(
  entries: ImportEntry[],
  existing: GuestInvitation[],
  write: (entry: ImportEntry) => Promise<void>,
  report: (result: ImportResult) => void,
) {
  const seen: GuestDraft[] = [...existing];
  for (const entry of entries) {
    const draft = validateGuest(entry.draft);
    const original = existing.find((g) => g.id === entry.id);
    if (original) {
      report({ id: entry.id, state: "saved", message: "הזמנה זו כבר נשמרה" });
      continue;
    }
    const duplicate = guestDuplicate(draft, seen);
    if (duplicate) {
      report({ id: entry.id, state: "duplicate", message: duplicate });
      continue;
    }
    await write({ ...entry, draft });
    seen.push(draft);
    report({ id: entry.id, state: "saved", message: "נשמרה" });
  }
}
// Escape spreadsheet formula prefixes. Also escape an initial apostrophe so
// files exported here can be imported without losing the original text.
export function csvSafeText(value: string) {
  return /^[\s]*[=+\-@\t\r]/.test(value) || value.startsWith("'")
    ? "'" + value
    : value;
}
export function csvOriginalText(value: string) {
  return value.startsWith("'") &&
    (value[1] === "'" || /^[\s]*[=+\-@\t\r]/.test(value.slice(1)))
    ? value.slice(1)
    : value;
}
export function exportGuestRows(guests: GuestDraft[]): (string | number)[][] {
  const sides = { one: "צד 1", two: "צד 2", shared: "משותף" };
  const rsvps = {
    pending: "טרם השיבו",
    confirmed: "מגיעים",
    declined: "לא מגיעים",
  };
  return [
    guestColumns.map((c) => c.label),
    ...guests.map((g) =>
      guestColumns.map((c) =>
        c.key === "side"
          ? sides[g.side]
          : c.key === "rsvp"
            ? rsvps[g.rsvp]
            : g[c.key],
      ),
    ),
  ];
}
