import { parseDate } from "./domain";
export function validTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(0);
    return zone.length <= 100 && !!zone.trim();
  } catch {
    return false;
  }
}
export function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jerusalem";
}
function parts(ms: number, zone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(ms)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}
export function meetingWallTime(instant: string, zone: string) {
  return parts(Date.parse(instant), zone);
}
export function wallTimeToInstant(date: string, time: string, zone: string) {
  if (
    !parseDate(date) ||
    Number(date.slice(0, 4)) < 1900 ||
    Number(date.slice(0, 4)) > 2200 ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    throw Error("יש להזין תאריך בשנים 1900–2200 ושעה תקינה בפורמט HH:MM.");
  if (!validTimeZone(zone))
    throw Error("יש לבחור אזור זמן תקין, למשל Asia/Jerusalem.");
  const nominal = Date.parse(`${date}T${time}:00.000Z`);
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = nominal + hours * 3600000;
    const local = parts(probe, zone);
    offsets.add(Date.parse(`${local.date}T${local.time}:00.000Z`) - probe);
  }
  const matches = [...offsets]
    .map((offset) => nominal - offset)
    .filter((ms) => {
      const local = parts(ms, zone);
      return local.date === date && local.time === time;
    });
  if (matches.length === 0)
    throw Error(
      "השעה אינה קיימת באזור הזמן הזה בגלל מעבר שעון. בחרו שעה אחרת.",
    );
  if (matches.length > 1)
    throw Error("השעה מופיעה פעמיים בגלל מעבר שעון. בחרו שעה שאינה כפולה.");
  return new Date(matches[0]).toISOString();
}
export function formatMeetingTime(instant: string, zone: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: zone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(instant));
}
