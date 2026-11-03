export const DOCUMENT_LIMIT = 5 * 1024 * 1024;
export type WeddingDocument = {
  id: string;
  wedding_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  vendor_id: string | null;
  payment_id: string | null;
  created_at: string;
};
export function validateDocument(
  name: string,
  mime: string,
  bytes: Uint8Array,
) {
  const clean = name.trim();
  if (!clean || clean.length > 160)
    throw Error("שם המסמך חייב להכיל 1–160 תווים.");
  if (!bytes.length || bytes.length > DOCUMENT_LIMIT)
    throw Error("יש לבחור קובץ עד 5MB שאינו ריק.");
  const pdf =
    mime === "application/pdf" &&
    String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  const png =
    mime === "image/png" &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  const jpg =
    mime === "image/jpeg" &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255;
  if (!pdf && !png && !jpg)
    throw Error("נתמכים קובצי PDF, PNG ו־JPEG תקינים בלבד.");
  return { name: clean, mime_type: mime, size_bytes: bytes.length };
}
const alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
// Avoid relying on browser-only atob/btoa globals in Hermes.
export function bytesToBase64(bytes: Uint8Array) {
  const chunks: string[] = [];
  let block = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i],
      b = bytes[i + 1] ?? 0,
      c = bytes[i + 2] ?? 0;
    block +=
      alphabet[a >> 2] +
      alphabet[((a & 3) << 4) | (b >> 4)] +
      (i + 1 < bytes.length ? alphabet[((b & 15) << 2) | (c >> 6)] : "=") +
      (i + 2 < bytes.length ? alphabet[c & 63] : "=");
    if (block.length >= 8192) {
      chunks.push(block);
      block = "";
    }
  }
  chunks.push(block);
  return chunks.join("");
}
export function base64ToBytes(value: string) {
  if (
    typeof value !== "string" ||
    value.length > Math.ceil(DOCUMENT_LIMIT / 3) * 4
  )
    throw Error("הקובץ גדול מדי.");
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  if (
    value.length % 4 !== 0 ||
    /[^A-Za-z0-9+/=]/.test(value) ||
    value.slice(0, value.length - padding).includes("=")
  )
    throw Error("קידוד הקובץ אינו תקין.");
  const bytes = new Uint8Array((value.length / 4) * 3 - padding);
  let offset = 0;
  for (let i = 0; i < value.length; i += 4) {
    const a = alphabet.indexOf(value[i]),
      b = alphabet.indexOf(value[i + 1]),
      c = Math.max(0, alphabet.indexOf(value[i + 2])),
      d = Math.max(0, alphabet.indexOf(value[i + 3]));
    bytes[offset++] = (a << 2) | (b >> 4);
    if (offset < bytes.length) bytes[offset++] = ((b & 15) << 4) | (c >> 2);
    if (offset < bytes.length) bytes[offset++] = ((c & 3) << 6) | d;
  }
  return bytes;
}
