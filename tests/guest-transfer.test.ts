import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { emptyGuest, type GuestInvitation } from "../src/core/guests";
import {
  guestDuplicate,
  guessGuestMapping,
  previewGuestImport,
  runGuestImport,
  type ImportResult,
} from "../src/core/guestTransfer";
import {
  createGuestExport,
  readGuestWorkbook,
} from "../src/services/guestSpreadsheet";
const guest = {
  ...emptyGuest(),
  name: 'משפחת "כהן", אורחים',
  phone: "0501234567",
  notes: "שורה ראשונה\nשורה שנייה",
  side: "one" as const,
};
const existing = { ...guest, id: "one", wedding_id: "w", version: 1 };
test("XLSX and CSV round-trip Hebrew, leading zero, commas, quotes, newlines and RSVP counts", () => {
  for (const format of ["xlsx", "csv"] as const) {
    const source = {
      ...guest,
      rsvp: "confirmed" as const,
      invited_adults: 3,
      confirmed_adults: 2,
      invited_children: 1,
      confirmed_children: 1,
    };
    const file = createGuestExport([source], format);
    const { table } = readGuestWorkbook(file.bytes, `guests.${format}`)
      .sheets[0];
    const preview = previewGuestImport(
      table,
      guessGuestMapping(table.headers),
      [],
    );
    assert.equal(preview.length, 1);
    assert.equal(preview[0].error, "");
    assert.deepEqual(preview[0].draft, source);
  }
});
test("exported formulas remain text; CSV prefixes are escaped and reversible", () => {
  for (const notes of [
    '=HYPERLINK("https://example.com")',
    "+123",
    "-123",
    "@SUM(1)",
    "'original",
    "\t=1",
  ]) {
    const source = { ...guest, notes: notes.trim() };
    for (const format of ["xlsx", "csv"] as const) {
      const file = createGuestExport([source], format);
      if (format === "xlsx") {
        const b = XLSX.read(file.bytes, { type: "array" });
        assert.equal(b.Sheets[b.SheetNames[0]].L2.f, undefined);
        assert.equal(b.Sheets[b.SheetNames[0]].L2.t, "s");
      }
      const { table } = readGuestWorkbook(file.bytes, `guests.${format}`)
        .sheets[0];
      assert.equal(
        previewGuestImport(table, guessGuestMapping(table.headers), [])[0].draft
          ?.notes,
        source.notes,
      );
    }
  }
});
test("header mapping supports English and missing optional defaults, rejects conflicting mapping", () => {
  const table = {
    headers: ["name", "phone", "adults"],
    rows: [["אורח", "0500000000", "2"]],
    formulaRows: [],
  };
  const mapping = guessGuestMapping(table.headers),
    r = previewGuestImport(table, mapping, [])[0];
  assert.equal(r.draft?.invited_adults, 2);
  assert.equal(r.draft?.side, "shared");
  assert.equal(r.draft?.rsvp, "pending");
  assert.throws(() => previewGuestImport(table, { phone: 1 }, []), /שם/);
  assert.throws(
    () => previewGuestImport(table, { name: 0, phone: 0 }, []),
    /אותה עמודה/,
  );
});
test("invalid counts, RSVP, missing names and formula cells are surfaced before any write", () => {
  const table = {
    headers: ["name", "adults", "rsvp", "confirmed_adults"],
    rows: [
      ["", "1", "", ""],
      ["א", "2.5", "", ""],
      ["ב", "1", "confirmed", "2"],
      ["ג", "1", "unknown", ""],
      ["ד", "1", "", ""],
      ["ה", "1", "confirmed", ""],
    ],
    formulaRows: [4],
  };
  const rows = previewGuestImport(table, guessGuestMapping(table.headers), []);
  assert.ok(rows.every((r) => r.error));
  assert.match(rows[4].error, /נוסחה/);
});
test("duplicates detect Israeli international phones, repeated file rows and same name+side", () => {
  assert.ok(guestDuplicate({ ...guest, phone: "+972-50-1234567" }, [guest]));
  assert.ok(guestDuplicate({ ...guest, phone: "00972501234567" }, [guest]));
  assert.equal(
    guestDuplicate({ ...guest, name: "אחר", phone: "" }, [guest]),
    "",
  );
  const file = createGuestExport([guest, guest], "csv"),
    { table } = readGuestWorkbook(file.bytes, "g.csv").sheets[0];
  assert.equal(
    previewGuestImport(table, guessGuestMapping(table.headers), [])[0]
      .duplicate,
    "",
  );
  assert.ok(
    previewGuestImport(table, guessGuestMapping(table.headers), [])[1]
      .duplicate,
  );
  assert.ok(
    previewGuestImport(table, guessGuestMapping(table.headers), [existing])[0]
      .duplicate,
  );
});
test("imports stop on failure and retry stable IDs without overwriting an acknowledged row", async () => {
  const entries = [
    { id: "a", draft: { ...guest, name: "א", phone: "0500000001" } },
    { id: "b", draft: { ...guest, name: "ב", phone: "0500000002" } },
    { id: "c", draft: { ...guest, name: "ג", phone: "0500000003" } },
  ];
  const rows: GuestInvitation[] = [],
    reports: ImportResult[] = [];
  await assert.rejects(
    runGuestImport(
      entries,
      rows,
      async (e) => {
        rows.push({ ...e.draft, id: e.id, wedding_id: "w", version: 1 });
        if (e.id === "b") throw Error("network result unknown");
      },
      (r) => reports.push(r),
    ),
    /unknown/,
  );
  assert.deepEqual(
    reports.map((r) => r.id),
    ["a"],
  );
  assert.equal(rows.length, 2);
  rows[1].notes = "edited remotely";
  await runGuestImport(
    entries,
    rows,
    async (e) => {
      rows.push({ ...e.draft, id: e.id, wedding_id: "w", version: 1 });
    },
    (r) => reports.push(r),
  );
  assert.equal(rows.length, 3);
  assert.equal(rows[1].notes, "edited remotely");
});
test("freshly added duplicates are skipped at write-time", async () => {
  let writes = 0;
  const results: ImportResult[] = [];
  await runGuestImport(
    [{ id: "new", draft: guest }],
    [existing],
    async () => {
      writes++;
    },
    (r) => results.push(r),
  );
  assert.equal(writes, 0);
  assert.equal(results[0].state, "duplicate");
});
test("CSV supports BOM, semicolons and tabs, rejects malformed quoting and bad UTF-8", () => {
  for (const sep of [";", "\t"]) {
    const file = new TextEncoder().encode(
      "\uFEFFname" + sep + 'phone\r\n"אורח"' + sep + '"0501234567"\r\n',
    );
    const table = readGuestWorkbook(file, "g.csv").sheets[0].table;
    assert.equal(
      previewGuestImport(table, guessGuestMapping(table.headers), [])[0].draft
        ?.phone,
      "0501234567",
    );
  }
  assert.throws(
    () =>
      readGuestWorkbook(new TextEncoder().encode('name\n"unclosed'), "g.csv"),
    /מרכאות/,
  );
  assert.throws(() => readGuestWorkbook(new Uint8Array([255]), "g.csv"));
});
test("XLSX supports multiple sheets and blocks formulas and oversized ranges", () => {
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    b,
    XLSX.utils.aoa_to_sheet([["name"], ["א"]]),
    "ראשון",
  );
  const sheet = XLSX.utils.aoa_to_sheet([["name"], ["ב"]]);
  sheet.A2.f = "1+1";
  XLSX.utils.book_append_sheet(b, sheet, "שני");
  const book = readGuestWorkbook(
    new Uint8Array(XLSX.write(b, { type: "array", bookType: "xlsx" })),
    "g.xlsx",
  );
  assert.equal(book.sheets.length, 2);
  assert.ok(previewGuestImport(book.sheets[1].table, { name: 0 }, [])[0].error);
  sheet["!ref"] = "A1:A502";
  assert.throws(
    () =>
      readGuestWorkbook(
        new Uint8Array(XLSX.write(b, { type: "array", bookType: "xlsx" })),
        "g.xlsx",
      ),
    /מגבלה/,
  );
  assert.throws(
    () => readGuestWorkbook(new Uint8Array(5 * 1024 * 1024 + 1), "g.xlsx"),
    /גדול/,
  );
  assert.throws(() => readGuestWorkbook(new Uint8Array([1]), "g.xlsx"), /תקין/);
});

test("CSV codec works without native TextEncoder/TextDecoder globals", () => {
  const encoder = Object.getOwnPropertyDescriptor(globalThis, "TextEncoder");
  const decoder = Object.getOwnPropertyDescriptor(globalThis, "TextDecoder");
  try {
    Object.defineProperty(globalThis, "TextEncoder", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "TextDecoder", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const file = createGuestExport([guest], "csv");
    const table = readGuestWorkbook(file.bytes, "g.csv").sheets[0].table;
    assert.deepEqual(
      previewGuestImport(table, guessGuestMapping(table.headers), [])[0].draft,
      guest,
    );
  } finally {
    if (encoder) Object.defineProperty(globalThis, "TextEncoder", encoder);
    if (decoder) Object.defineProperty(globalThis, "TextDecoder", decoder);
  }
});
