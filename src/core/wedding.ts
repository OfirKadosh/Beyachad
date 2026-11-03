import { parseDate, type Wedding } from "./domain";
import { localDateKey } from "./tasks";
export type WeddingDetails = Pick<
  Wedding,
  "partner_one" | "partner_two" | "wedding_date"
>;
export const weddingConflict =
  "פרטי החתונה השתנו. הטיוטה נשארת כאן; פתחו את המסך מחדש לפני שמירה.";
export function validateWeddingDetails(input: WeddingDetails): WeddingDetails {
  const partner_one = input.partner_one.trim(),
    partner_two = input.partner_two.trim();
  if (partner_one.length > 60 || partner_two.length > 60)
    throw Error("כל שם יכול להכיל עד 60 תווים.");
  return {
    partner_one,
    partner_two,
    wedding_date: parseDate(input.wedding_date?.trim() ?? ""),
  };
}
export function updateWeddingDetails(
  current: Wedding | null,
  original: Wedding,
  input: WeddingDetails,
): Wedding {
  if (
    !current ||
    current.id !== original.id ||
    (current.details_version ?? 1) !== (original.details_version ?? 1)
  )
    throw Error(weddingConflict);
  return {
    ...current,
    ...validateWeddingDetails(input),
    details_version: (current.details_version ?? 1) + 1,
  };
}
export function daysUntil(
  date: string | null,
  now = new Date(),
): number | null {
  if (!date) return null;
  parseDate(date);
  // Calendar days in the viewer's zone, independent of DST and time of day.
  return Math.round(
    (Date.parse(date + "T12:00:00Z") -
      Date.parse(localDateKey(now) + "T12:00:00Z")) /
      86400000,
  );
}
