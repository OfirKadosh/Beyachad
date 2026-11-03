import { validTimeZone } from "./meetingTime";
export const meetingStatuses = {
  scheduled: "מתוכננת",
  done: "התקיימה",
  cancelled: "בוטלה",
} as const;
export type MeetingDraft = {
  title: string;
  starts_at: string;
  time_zone: string;
  duration_minutes: number;
  location: string;
  vendor_id: string | null;
  owner: "both" | "one" | "two";
  status: keyof typeof meetingStatuses;
  reminder_minutes: number | null;
  notes: string;
};
export type Meeting = MeetingDraft & {
  id: string;
  wedding_id: string;
  version: number;
};
export const meetingConflict =
  "הפגישה השתנתה או נמחקה ממכשיר אחר. הנתונים רועננו; פתחו אותה מחדש לפני שמירה.";
export function validateMeeting(input: MeetingDraft): MeetingDraft {
  if (!input.title.trim() || input.title.trim().length > 100)
    throw Error("יש להזין כותרת לפגישה עד 100 תווים.");
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.starts_at) ||
    !Number.isFinite(Date.parse(input.starts_at)) ||
    Number(input.starts_at.slice(0, 4)) < 1900 ||
    Number(input.starts_at.slice(0, 4)) > 2200
  )
    throw Error("מועד הפגישה אינו תקין.");
  if (new Date(input.starts_at).toISOString() !== input.starts_at)
    throw Error("מועד הפגישה אינו תקין.");
  if (
    !validTimeZone(input.time_zone) ||
    !Number.isInteger(input.duration_minutes) ||
    input.duration_minutes < 15 ||
    input.duration_minutes > 1440
  )
    throw Error("יש לבחור אזור זמן ומשך של 15–1,440 דקות.");
  if (
    !["both", "one", "two"].includes(input.owner) ||
    !Object.hasOwn(meetingStatuses, input.status) ||
    !(
      input.reminder_minutes === null ||
      [0, 15, 60, 1440].includes(input.reminder_minutes)
    )
  )
    throw Error("הגדרות הפגישה אינן תקינות.");
  if (input.location.length > 300 || input.notes.length > 2000)
    throw Error("פרטי הפגישה ארוכים מדי.");
  return {
    title: input.title.trim(),
    starts_at: new Date(input.starts_at).toISOString(),
    time_zone: input.time_zone.trim(),
    duration_minutes: input.duration_minutes,
    location: input.location.trim(),
    vendor_id: input.vendor_id,
    owner: input.owner,
    status: input.status,
    reminder_minutes: input.reminder_minutes,
    notes: input.notes.trim(),
  };
}
export function overlappingMeetings(
  rows: Meeting[],
  draft: MeetingDraft,
  id?: string,
) {
  if (draft.status !== "scheduled") return [];
  const start = Date.parse(draft.starts_at),
    end = start + draft.duration_minutes * 60000;
  return rows.filter(
    (m) =>
      m.id !== id &&
      m.status === "scheduled" &&
      (m.owner === "both" ||
        draft.owner === "both" ||
        m.owner === draft.owner) &&
      Date.parse(m.starts_at) < end &&
      Date.parse(m.starts_at) + m.duration_minutes * 60000 > start,
  );
}
export function saveMeetingState(
  rows: Meeting[],
  id: string,
  weddingId: string,
  expected: number | null,
  input: MeetingDraft,
): Meeting[] {
  const valid = validateMeeting(input),
    old = rows.find((m) => m.id === id);
  if (expected === null) {
    if (old) {
      if (
        old.wedding_id === weddingId &&
        Object.entries(valid).every(
          ([k, v]) => (old as unknown as Record<string, unknown>)[k] === v,
        )
      )
        return rows;
      throw Error(meetingConflict);
    }
    return [...rows, { ...valid, id, wedding_id: weddingId, version: 1 }];
  }
  if (!old || old.wedding_id !== weddingId || old.version !== expected)
    throw Error(meetingConflict);
  return rows.map((m) =>
    m.id === id ? { ...old, ...valid, version: old.version + 1 } : m,
  );
}
export function deleteMeetingState(rows: Meeting[], original: Meeting) {
  const old = rows.find((m) => m.id === original.id);
  if (
    !old ||
    old.version !== original.version ||
    old.wedding_id !== original.wedding_id
  )
    throw Error(meetingConflict);
  return rows.filter((m) => m.id !== original.id);
}
