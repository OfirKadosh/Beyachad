import type { GuestInvitation } from "./guests";
// Respect server row caps while keeping totals based on all visible invitations.
export async function loadGuestPages<
  T extends { id: string } = GuestInvitation,
>(
  fetchPage: (
    from: number,
    to: number,
  ) => Promise<{ rows: T[]; count: number | null }>,
) {
  const found = new Map<string, T>();
  let offset = 0;
  for (;;) {
    const { rows, count } = await fetchPage(offset, offset + 499);
    for (const row of rows) found.set(row.id, row);
    offset += rows.length;
    if (count !== null ? offset >= count : rows.length < 500) break;
    if (!rows.length) throw Error("Incomplete guest list");
  }
  return [...found.values()];
}
