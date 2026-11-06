import { useMemo, useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import {
  Button,
  Card,
  Notice,
  Screen,
  styles,
  Title,
  useAction,
  Loading,
} from "../components/ui";
import { Choice } from "../components/Choice";
import {
  guestColumns,
  guessGuestMapping,
  MAX_IMPORT_BYTES,
  previewGuestImport,
  type ColumnMapping,
  type ImportResult,
} from "../core/guestTransfer";
import { selectGuests, type GuestDraft } from "../core/guests";
import { useGuests } from "../providers/GuestProvider";
import { useWedding } from "../providers/WeddingProvider";
import { readPickedFile } from "../services/documentFiles";
import {
  createGuestExport,
  readGuestWorkbook,
  type GuestWorkbook,
} from "../services/guestSpreadsheet";
import { exportFile } from "../services/exportFile";
export default function GuestTransfer() {
  const { loading } = useGuests();
  return loading ? <Loading /> : <Transfer />;
}
function Transfer() {
  const store = useGuests(),
    action = useAction();
  const { wedding } = useWedding();
  const params = useLocalSearchParams<{
    query?: string;
    rsvp?: string;
    side?: string;
    group?: string;
  }>();
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx"),
    [scope, setScope] = useState<"all" | "filtered">("all");
  const [workbook, setWorkbook] = useState<GuestWorkbook | null>(null),
    [filename, setFilename] = useState("");
  const [sheet, setSheet] = useState("0"),
    [mapping, setMapping] = useState<ColumnMapping>({}),
    [mappingOpen, setMappingOpen] = useState(false);
  const [excluded, setExcluded] = useState<number[]>([]),
    [results, setResults] = useState<Record<string, ImportResult>>({}),
    [started, setStarted] = useState(false),
    [visible, setVisible] = useState(20);
  const [ids, setIds] = useState<string[]>([]);
  const [approved, setApproved] = useState<string[]>([]);
  const table = workbook?.sheets[Number(sheet)]?.table;
  const preview = useMemo(() => {
    if (!table) return { rows: [], error: "" };
    try {
      return {
        rows: previewGuestImport(table, mapping, store.guests),
        error: "",
      };
    } catch (e) {
      return {
        rows: [],
        error: e instanceof Error ? e.message : "הקובץ אינו תקין",
      };
    }
  }, [table, mapping, store.guests]);
  const selected = preview.rows.filter(
    (row, i) =>
      row.draft &&
      !row.error &&
      !row.duplicate &&
      !excluded.includes(i) &&
      !results[ids[i]],
  );
  // Retain pending stable IDs after an uncertain write, even if a reload now
  // detects the row as a duplicate. The provider recognizes acknowledged IDs.
  const pendingRetry = started
    ? preview.rows.filter(
        (row, i) =>
          row.draft &&
          !row.error &&
          !excluded.includes(i) &&
          approved.includes(ids[i]) &&
          !results[ids[i]],
      )
    : selected;
  const eligible = pendingRetry;
  const imported = Object.values(results).filter(
    (r) => r.state === "saved",
  ).length;
  const filtered = selectGuests(store.guests, {
    query: params.query ?? "",
    rsvp: ["pending", "confirmed", "declined"].includes(params.rsvp ?? "")
      ? (params.rsvp as GuestDraft["rsvp"])
      : "all",
    side: ["one", "two", "shared"].includes(params.side ?? "")
      ? (params.side as GuestDraft["side"])
      : "all",
    group: params.group,
  });
  function setTable(nextSheet: string, book: GuestWorkbook = workbook!) {
    setSheet(nextSheet);
    setMapping(guessGuestMapping(book.sheets[Number(nextSheet)].table.headers));
    setIds(
      book.sheets[Number(nextSheet)].table.rows.map(() => Crypto.randomUUID()),
    );
    setExcluded([]);
    setResults({});
    setStarted(false);
    setApproved([]);
    setVisible(20);
  }
  async function pick() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "text/csv",
        "text/comma-separated-values",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > MAX_IMPORT_BYTES)
      throw Error("בחרו קובץ עד 5MB.");
    const bytes = await readPickedFile(asset),
      book = readGuestWorkbook(bytes, asset.name);
    setWorkbook(book);
    setFilename(asset.name);
    setTable("0", book);
  }
  async function download(template = false) {
    const file = createGuestExport(
      template ? [] : scope === "all" ? store.guests : filtered,
      format,
    );
    await exportFile(
      file.bytes,
      `beyachad-guests-${template ? "template" : new Date().toISOString().slice(0, 10)}.${file.extension}`,
      file.mime,
    );
  }
  return (
    <Screen>
      <Button
        title="חזרה למוזמנים"
        secondary
        disabled={action.busy}
        onPress={() => router.dismissTo("/guests")}
      />
      <Title>ייבוא וייצוא מוזמנים</Title>
      {!!store.error && (
        <Card>
          <Notice text={store.error} error />
          <Button
            title="רענון הרשימה לפני המשך"
            disabled={action.busy}
            onPress={() =>
              void action.run(async () => {
                if (!(await store.reload()))
                  throw Error("הרענון נכשל. בדקו חיבור ונסו שוב.");
              })
            }
          />
        </Card>
      )}
      <Card>
        <Text style={styles.heading}>ייצוא רשימת המוזמנים</Text>
        <Choice<"xlsx" | "csv">
          label="סוג קובץ"
          value={format}
          options={[
            { value: "xlsx", label: "Excel" },
            { value: "csv", label: "CSV" },
          ]}
          onChange={setFormat}
          disabled={action.busy}
        />
        <Choice<"all" | "filtered">
          label="מה לייצא"
          value={scope}
          options={[
            { value: "all", label: `כל הרשימה (${store.guests.length})` },
            {
              value: "filtered",
              label: `לפי הסינון במסך המוזמנים (${filtered.length})`,
            },
          ]}
          onChange={setScope}
          disabled={action.busy}
        />
        <Text style={styles.muted}>
          הקובץ כולל טלפונים, הערות וצרכים תזונתיים. שתפו אותו רק עם מי שצריך.
          Excel שומר מספרי טלפון כטקסט; בפתיחת CSV הגדירו עמודת טלפון כטקסט כדי
          לשמור אפס מוביל.
        </Text>
        <Button
          title="ייצוא הרשימה"
          disabled={
            action.busy || !(scope === "all" ? store.guests : filtered).length
          }
          onPress={() => void action.run(() => download())}
        />
        <Button
          title="הורדת תבנית ריקה"
          secondary
          disabled={action.busy}
          onPress={() => void action.run(() => download(true))}
        />
      </Card>
      <Card>
        <Text style={styles.heading}>ייבוא מקובץ</Text>
        <Text style={styles.text}>
          בחרו XLSX או CSV בקידוד UTF-8, עם כותרות בשורה הראשונה. עד 500 הזמנות
          ו־5MB. כל שורה היא הזמנה לאדם, לזוג או למשפחה.
        </Text>
        <Text style={styles.muted}>
          רק שם להזמנה הוא חובה. ברירת המחדל: מבוגר אחד, ללא ילדים, צד משותף
          וטרם השיבו. צד 1: {wedding?.partner_one || "הצד הראשון"}; צד 2:{" "}
          {wedding?.partner_two || "הצד השני"}. למגיעים יש להזין גם את מספר
          המאשרים.
        </Text>
        <Button
          title={workbook ? "בחירת קובץ אחר" : "בחירת קובץ לייבוא"}
          disabled={action.busy}
          onPress={() => void action.run(pick)}
        />
        {!!filename && <Text style={styles.muted}>{filename}</Text>}
        {workbook && workbook.sheets.length > 1 && (
          <Choice
            label="גיליון לייבוא"
            value={sheet}
            options={workbook.sheets.map((s, i) => ({
              value: String(i),
              label: s.name,
            }))}
            onChange={(s) => setTable(s)}
            disabled={action.busy || started}
          />
        )}
        {table && (
          <>
            <Button
              title={mappingOpen ? "סגירת התאמת העמודות" : "התאמת עמודות בקובץ"}
              secondary
              disabled={action.busy}
              onPress={() => setMappingOpen(!mappingOpen)}
            />
            {mappingOpen &&
              guestColumns.map((col) => (
                <Choice
                  key={col.key}
                  label={col.label}
                  value={
                    mapping[col.key] === undefined
                      ? ""
                      : String(mapping[col.key])
                  }
                  options={[
                    { value: "", label: "לא בקובץ" },
                    ...table.headers.map((h, i) => ({
                      value: String(i),
                      label: `${i + 1}: ${h || "ללא כותרת"}`,
                    })),
                  ]}
                  disabled={action.busy || started}
                  onChange={(v) => {
                    setMapping((m) => {
                      const next = { ...m };
                      if (v === "") delete next[col.key];
                      else next[col.key] = Number(v);
                      return next;
                    });
                    setExcluded([]);
                  }}
                />
              ))}
            {!!preview.error && <Notice text={preview.error} error />}
            <Text style={styles.heading}>תצוגה מקדימה</Text>
            <Text style={styles.text}>
              {preview.rows.length} שורות ·{" "}
              {preview.rows.filter((r) => !!r.error).length} שגויות ·{" "}
              {
                preview.rows.filter((r, i) => !!r.duplicate && !results[ids[i]])
                  .length
              }{" "}
              כפילויות אפשריות
            </Text>
            <Text style={styles.muted}>
              שורות שגויות וכפילויות לא מתווספות. אין שינוי בהזמנות קיימות. אפשר
              להוציא שורות מהייבוא ולתקן את הקובץ המקורי.
            </Text>
            {imported > 0 && <Notice text={`נשמרו ${imported} הזמנות.`} />}
            <Text style={styles.muted}>
              השמירה מתבצעת לפי שורות. בכשל חיבור, שורות שכבר נשמרו נשארות
              ברשימה. אל תסגרו את המסך עד הסיום.
            </Text>
            <Button
              title={
                started
                  ? `המשך ייבוא (${eligible.length})`
                  : `אישור ייבוא (${eligible.length})`
              }
              busy={action.busy}
              disabled={
                action.busy ||
                !!store.error ||
                !!preview.error ||
                !eligible.length
              }
              onPress={() =>
                void action.run(async () => {
                  setApproved(eligible.map((row) => ids[row.row - 2]));
                  setStarted(true);
                  await store.importGuests(
                    eligible.map((row) => ({
                      id: ids[row.row - 2],
                      draft: row.draft!,
                    })),
                    (result) =>
                      setResults((old) => ({ ...old, [result.id]: result })),
                  );
                }, "הייבוא הסתיים. הרשימה מעודכנת.")
              }
            />
          </>
        )}
      </Card>
      {!!action.message && (
        <Notice text={action.message} error={action.failed} />
      )}
      {preview.rows.slice(0, visible).map((row, i) => {
        const result = results[ids[i]];
        return (
          <Card key={i}>
            <Text style={styles.heading}>
              שורה {row.row}: {row.draft?.name || "יש לתקן את השורה"}
            </Text>
            {row.draft && (
              <Text style={styles.text}>
                {row.draft.phone || "ללא טלפון"} · {row.draft.invited_adults}{" "}
                מבוגרים · {row.draft.invited_children} ילדים
              </Text>
            )}
            {!!row.error && <Notice text={row.error} error />}
            {!!result && <Text style={styles.muted}>{result.message}</Text>}
            {!result && !!row.duplicate && (
              <Text style={styles.muted}>{row.duplicate} — השורה תידלג</Text>
            )}
            {!row.error && !row.duplicate && !result && (
              <Button
                title={`${excluded.includes(i) ? "הכללת" : "הוצאת"} שורה ${row.row}`}
                secondary
                disabled={action.busy || started}
                onPress={() =>
                  setExcluded((old) =>
                    old.includes(i) ? old.filter((n) => n !== i) : [...old, i],
                  )
                }
              />
            )}
          </Card>
        );
      })}
      {preview.rows.length > visible && (
        <Button
          title="הצגת שורות נוספות"
          secondary
          onPress={() => setVisible((n) => n + 20)}
        />
      )}
    </Screen>
  );
}
