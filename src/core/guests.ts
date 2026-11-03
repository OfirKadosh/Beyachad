import type { Wedding } from "./domain";
import type { MemberSlot } from "./tasks";
export const rsvpLabels = {
  pending: "טרם השיבו",
  confirmed: "מגיעים",
  declined: "לא מגיעים",
} as const;
export type GuestDraft = {
  name: string;
  contact: string;
  phone: string;
  side: "one" | "two" | "shared";
  group_name: string;
  invited_adults: number;
  invited_children: number;
  rsvp: keyof typeof rsvpLabels;
  confirmed_adults: number;
  confirmed_children: number;
  dietary: string;
  notes: string;
};
export type GuestInvitation = GuestDraft & {
  id: string;
  wedding_id: string;
  version: number;
};
export const guestConflict =
  "ההזמנה השתנתה או נמחקה ממכשיר אחר. הנתונים רועננו; פתחו אותה מחדש לפני שמירה.";
export function emptyGuest(): GuestDraft {
  return {
    name: "",
    contact: "",
    phone: "",
    side: "shared",
    group_name: "",
    invited_adults: 1,
    invited_children: 0,
    rsvp: "pending",
    confirmed_adults: 0,
    confirmed_children: 0,
    dietary: "",
    notes: "",
  };
}
export function parseCount(text: string) {
  if (!/^\d+$/.test(text.trim()))
    throw Error("יש להזין מספר שלם מאפס ועד 100.");
  const n = Number(text);
  if (!Number.isSafeInteger(n) || n > 100)
    throw Error("יש להזין מספר שלם מאפס ועד 100.");
  return n;
}
export function validateGuest(input: GuestDraft): GuestDraft {
  if (!input.name.trim() || input.name.trim().length > 100)
    throw Error("יש להזין שם להזמנה עד 100 תווים.");
  if (
    input.contact.length > 100 ||
    input.phone.length > 40 ||
    input.group_name.length > 50 ||
    input.dietary.length > 1000 ||
    input.notes.length > 2000
  )
    throw Error("פרטי ההזמנה ארוכים מדי.");
  if (
    !["one", "two", "shared"].includes(input.side) ||
    !Object.hasOwn(rsvpLabels, input.rsvp)
  )
    throw Error("יש לבחור צד ומצב הגעה תקינים.");
  for (const n of [
    input.invited_adults,
    input.invited_children,
    input.confirmed_adults,
    input.confirmed_children,
  ])
    if (!Number.isSafeInteger(n) || n < 0 || n > 100)
      throw Error("כמויות האנשים צריכות להיות מספרים שלמים מאפס ועד 100.");
  const invited = input.invited_adults + input.invited_children;
  if (invited < 1 || invited > 100)
    throw Error("כל הזמנה צריכה לכלול בין אדם אחד ל־100 אנשים.");
  if (
    input.confirmed_adults > input.invited_adults ||
    input.confirmed_children > input.invited_children
  )
    throw Error("מספר המאשרים בכל קבוצה לא יכול להיות גדול ממספר המוזמנים בה.");
  if (
    input.rsvp === "confirmed"
      ? input.confirmed_adults + input.confirmed_children < 1
      : input.confirmed_adults + input.confirmed_children !== 0
  )
    throw Error(
      "למצב ״מגיעים״ יש להזין לפחות מאשר אחד; במצבים האחרים מספר המאשרים צריך להיות אפס.",
    );
  return {
    name: input.name.trim(),
    contact: input.contact.trim(),
    phone: input.phone.trim(),
    side: input.side,
    group_name: input.group_name.trim(),
    invited_adults: input.invited_adults,
    invited_children: input.invited_children,
    rsvp: input.rsvp,
    confirmed_adults: input.confirmed_adults,
    confirmed_children: input.confirmed_children,
    dietary: input.dietary.trim(),
    notes: input.notes.trim(),
  };
}
export function guestTotals(guests: GuestInvitation[]) {
  return guests.reduce(
    (total, guest) => {
      const invited = guest.invited_adults + guest.invited_children;
      const confirmed = guest.confirmed_adults + guest.confirmed_children;
      total.invitations++;
      total.invited += invited;
      total.invited_adults += guest.invited_adults;
      total.invited_children += guest.invited_children;
      total.confirmed += confirmed;
      total.confirmed_adults += guest.confirmed_adults;
      total.confirmed_children += guest.confirmed_children;
      if (guest.rsvp === "pending") {
        total.pending += invited;
        total.pending_invitations++;
      } else total.declined += invited - confirmed;
      return total;
    },
    {
      invitations: 0,
      invited: 0,
      invited_adults: 0,
      invited_children: 0,
      confirmed: 0,
      confirmed_adults: 0,
      confirmed_children: 0,
      pending: 0,
      pending_invitations: 0,
      declined: 0,
    },
  );
}
export function guestSideLabel(
  side: GuestDraft["side"],
  wedding: Wedding | null,
  viewer: MemberSlot,
) {
  if (side === "shared") return "משותף";
  const name = side === "one" ? wedding?.partner_one : wedding?.partner_two;
  return name
    ? `הצד של ${name}`
    : side === viewer
      ? "הצד שלי"
      : "הצד של בן/בת הזוג";
}
export function selectGuests(
  guests: GuestInvitation[],
  filter: {
    query: string;
    rsvp: GuestDraft["rsvp"] | "all";
    side: GuestDraft["side"] | "all";
    group?: string;
  },
) {
  const q = filter.query.trim().toLocaleLowerCase();
  return guests
    .filter(
      (g) =>
        (filter.rsvp === "all" || g.rsvp === filter.rsvp) &&
        (filter.side === "all" || g.side === filter.side) &&
        (!filter.group || g.group_name === filter.group) &&
        (!q ||
          [g.name, g.contact, g.phone, g.group_name, g.dietary, g.notes]
            .join(" ")
            .toLocaleLowerCase()
            .includes(q)),
    )
    .sort(
      (a, b) => a.name.localeCompare(b.name, "he") || a.id.localeCompare(b.id),
    );
}
export function duplicatePhone(
  guests: GuestInvitation[],
  phone: string,
  except?: string,
) {
  const digits = phone.replace(/\D/g, "");
  return (
    digits.length >= 7 &&
    guests.some((g) => g.id !== except && g.phone.replace(/\D/g, "") === digits)
  );
}
export function saveGuestState(
  guests: GuestInvitation[],
  id: string,
  weddingId: string,
  expected: number | null,
  input: GuestDraft,
): GuestInvitation[] {
  const valid = validateGuest(input);
  const original = guests.find((g) => g.id === id);
  if (expected === null) {
    if (original) {
      if (
        original.wedding_id === weddingId &&
        Object.entries(valid).every(
          ([key, value]) =>
            (original as unknown as Record<string, unknown>)[key] === value,
        )
      )
        return guests;
      throw Error(guestConflict);
    }
    return [...guests, { ...valid, id, wedding_id: weddingId, version: 1 }];
  }
  if (
    !original ||
    original.wedding_id !== weddingId ||
    original.version !== expected
  )
    throw Error(guestConflict);
  return guests.map((g) =>
    g.id === id ? { ...original, ...valid, version: original.version + 1 } : g,
  );
}
export function deleteGuestState(
  guests: GuestInvitation[],
  original: GuestInvitation,
) {
  const current = guests.find((g) => g.id === original.id);
  if (
    !current ||
    current.version !== original.version ||
    current.wedding_id !== original.wedding_id
  )
    throw Error(guestConflict);
  return guests.filter((g) => g.id !== original.id);
}
