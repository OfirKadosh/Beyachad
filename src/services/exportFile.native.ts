import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
export async function exportFile(
  bytes: Uint8Array,
  name: string,
  mime: string,
) {
  if (!(await Sharing.isAvailableAsync()))
    throw Error("שיתוף קבצים אינו זמין במכשיר הזה.");
  const file = new File(Paths.cache, `${Date.now()}-${name}`);
  try {
    file.write(bytes);
    await Sharing.shareAsync(file.uri, {
      mimeType: mime.split(";")[0],
      UTI: name.endsWith(".xlsx")
        ? "org.openxmlformats.spreadsheetml.sheet"
        : "public.comma-separated-values-text",
      dialogTitle: "שמירת רשימת המוזמנים",
    });
  } finally {
    if (file.exists) file.delete();
  }
}
