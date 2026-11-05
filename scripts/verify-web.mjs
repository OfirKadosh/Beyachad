import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
const root = new URL("../dist/", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const manifest = JSON.parse(
  await readFile(new URL("manifest.webmanifest", root), "utf8"),
);
assert.match(html, /<html[^>]*lang="he"[^>]*dir="rtl"/);
assert.equal((html.match(/rel="manifest"/g) || []).length, 1);
assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "/");
for (const icon of manifest.icons)
  await access(new URL(icon.src.slice(1), root));
await access(new URL("apple-touch-icon.png", root));
for (const [, src] of html.matchAll(/<script[^>]*src="([^"]+)"/g)) {
  if (src.startsWith("/")) await access(new URL(src.slice(1), root));
}
console.log(
  "PASS: exported HTML, manifest, home-screen icons and entry scripts exist.",
);
