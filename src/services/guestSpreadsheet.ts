import * as XLSX from "xlsx";
import {
  csvOriginalText,
  csvSafeText,
  exportGuestRows,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  type GuestTable,
} from "../core/guestTransfer";
import type { GuestDraft } from "../core/guests";
function decodeUtf8(bytes: Uint8Array) {
  try {
    if (typeof TextDecoder !== "undefined")
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decodeURIComponent(
      Array.from(bytes, (b) => "%" + b.toString(16).padStart(2, "0")).join(""),
    );
  } catch {
    throw Error(
      "קובץ CSV חייב להיות בקידוד UTF-8. שמרו מחדש כ־CSV UTF-8 מתוך Excel.",
    );
  }
}
function encodeUtf8(text: string) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text);
  const encoded = encodeURIComponent(text);
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === "%") {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(encoded.charCodeAt(i));
  }
  return new Uint8Array(bytes);
}
export type GuestWorkbook = { sheets: { name: string; table: GuestTable }[] };
function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    afterQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else cell += c;
    } else if (c === delimiter) {
      row.push(cell);
      cell = "";
      afterQuote = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      afterQuote = false;
    } else if (c === '"' && cell === "" && !afterQuote) quoted = true;
    else {
      if (afterQuote)
        throw Error("קובץ CSV אינו תקין: תווים אחרי סגירת מרכאות.");
      cell += c;
    }
    if (rows.length > MAX_IMPORT_ROWS + 1)
      throw Error(`ניתן לייבא עד ${MAX_IMPORT_ROWS} הזמנות בקובץ אחד.`);
  }
  if (quoted) throw Error("קובץ CSV אינו תקין: מרכאות שלא נסגרו.");
  if (cell !== "" || row.length || afterQuote) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}
export function readGuestWorkbook(
  bytes: Uint8Array,
  name: string,
): GuestWorkbook {
  if (bytes.length > MAX_IMPORT_BYTES)
    throw Error("הקובץ גדול מדי. ניתן לבחור קובץ עד 5MB.");
  if (!bytes.length) throw Error("הקובץ ריק.");
  if (/\.csv$/i.test(name)) {
    const text = decodeUtf8(bytes).replace(/^\uFEFF/, "");
    const first = text.split(/\r?\n/)[0];
    const delimiter = [",", ";", "\t"].sort(
      (a, b) => first.split(b).length - first.split(a).length,
    )[0];
    const rows = parseCsv(text, delimiter).map((r) => r.map(csvOriginalText));
    if (!rows.length) throw Error("הקובץ ריק.");
    return {
      sheets: [
        {
          name: "CSV",
          table: { headers: rows[0], rows: rows.slice(1), formulaRows: [] },
        },
      ],
    };
  }
  if (!/\.xlsx$/i.test(name))
    throw Error("בחרו קובץ Excel מסוג XLSX או CSV בקידוד UTF-8.");
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    throw Error("זה אינו קובץ XLSX תקין.");
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(bytes, {
      type: "array",
      sheetRows: MAX_IMPORT_ROWS + 2,
      cellFormula: true,
      cellText: true,
    });
  } catch {
    throw Error(
      "לא ניתן לקרוא את קובץ ה־Excel. בדקו שהוא תקין ואינו מוגן בסיסמה.",
    );
  }
  const sheets = book.SheetNames.map((name) => {
    const sheet = book.Sheets[name];
    const range = sheet["!fullref"] ?? sheet["!ref"];
    if (range) {
      const bounds = XLSX.utils.decode_range(range);
      if (bounds.e.r > MAX_IMPORT_ROWS || bounds.e.c > 49)
        throw Error("הגיליון חורג מהמגבלה: 500 שורות נתונים ו־50 עמודות.");
    }
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: true,
      range: 0,
    });
    const formulaRows: number[] = [];
    for (const [address, cell] of Object.entries(sheet)) {
      if (address.startsWith("!") || !cell?.f) continue;
      const r = XLSX.utils.decode_cell(address).r;
      if (r === 0) throw Error("שורת הכותרות מכילה נוסחה. יש להמיר לערכים.");
      formulaRows.push(r - 1);
    }
    return {
      name,
      table: {
        headers: rows[0] ?? [],
        rows: rows.slice(1).map((r) => r.map((v) => String(v))),
        formulaRows,
      },
    };
  }).filter((s) => s.table.headers.length);
  if (!sheets.length) throw Error("לא נמצאו גיליונות עם כותרות.");
  return { sheets };
}
export function createGuestExport(
  guests: GuestDraft[],
  format: "xlsx" | "csv",
) {
  const rows = exportGuestRows(guests);
  if (format === "csv") {
    const text =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map(
              (v) =>
                '"' +
                (typeof v === "number" ? String(v) : csvSafeText(v)).replace(
                  /"/g,
                  '""',
                ) +
                '"',
            )
            .join(","),
        )
        .join("\r\n") +
      "\r\n";
    return {
      bytes: encodeUtf8(text),
      mime: "text/csv;charset=utf-8",
      extension: "csv",
    };
  }
  const book = XLSX.utils.book_new(),
    sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = rows[0].map(() => ({ wch: 22 }));
  book.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(book, sheet, "מוזמנים");
  return {
    bytes: new Uint8Array(
      XLSX.write(book, { type: "array", bookType: "xlsx" }),
    ),
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
  };
}
