export const MAX_CENTS = 100_000_000_000;
export function parseMoney(value: string, required = false): number | null {
  const text = value.trim();
  if (!text) {
    if (required) throw Error("יש להזין סכום.");
    return null;
  }
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text))
    throw Error("יש להזין סכום חיובי עם עד שתי ספרות אחרי הנקודה.");
  const [whole, fraction = ""] = text.replaceAll(",", "").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS)
    throw Error("הסכום גדול מדי.");
  return cents;
}
export function money(cents: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
export function moneyInput(cents: number | null) {
  return cents === null ? "" : (cents / 100).toFixed(cents % 100 ? 2 : 0);
}
