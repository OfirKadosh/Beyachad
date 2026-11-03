import type { DocumentPickerAsset } from "expo-document-picker";
export async function readPickedFile(
  asset: DocumentPickerAsset,
): Promise<Uint8Array> {
  if (!asset.file) throw Error("לא ניתן לקרוא את הקובץ שנבחר.");
  return new Uint8Array(await asset.file.arrayBuffer());
}
export async function openLocalDocument(
  bytes: Uint8Array,
  name: string,
  mime: string,
): Promise<string | null> {
  const { bytesToBase64 } = await import("../core/documents");
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}
