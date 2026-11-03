import { File } from "expo-file-system";
import type { DocumentPickerAsset } from "expo-document-picker";
export async function readPickedFile(
  asset: DocumentPickerAsset,
): Promise<Uint8Array> {
  return new Uint8Array(await new File(asset.uri).arrayBuffer());
}
export async function openLocalDocument(
  bytes: Uint8Array,
  name: string,
  _mime: string,
): Promise<string | null> {
  const { Paths } = await import("expo-file-system");
  const { Share } = await import("react-native");
  const file = new File(
    Paths.cache,
    `beyachad-preview-${name.replace(/[^\p{L}\p{N}._-]/gu, "_")}`,
  );
  await file.write(bytes);
  try {
    await Share.share({ url: file.uri });
  } finally {
    if (file.exists) await file.delete();
  }
  return null;
}
