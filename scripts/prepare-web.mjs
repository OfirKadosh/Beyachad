import { readFile, writeFile } from "node:fs/promises";
const file = new URL("../dist/index.html", import.meta.url);
let html = await readFile(file, "utf8");
html = html.replace(/<html\b([^>]*)>/i, (_, attrs) => {
  const rest = attrs.replace(/\s+(lang|dir)=("[^"]*"|'[^']*')/gi, "");
  return `<html${rest} lang="he" dir="rtl">`;
});
html = html.replace(
  /<!-- beyachad-web -->[\s\S]*?<!-- \/beyachad-web -->\s*/g,
  "",
);
html = html.replace(
  "</head>",
  `<!-- beyachad-web -->
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#087F79">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="ביחד">
<meta name="description" content="מרחב משותף לתכנון החתונה שלכם">
<!-- /beyachad-web -->
</head>`,
);
await writeFile(file, html);
console.log("Web manifest and iPhone home-screen metadata ready.");
