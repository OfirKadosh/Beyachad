export async function exportFile(
  bytes: Uint8Array,
  name: string,
  mime: string,
) {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Safari may consume the URL after the click handler returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
