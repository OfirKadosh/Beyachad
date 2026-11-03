import { useState } from "react";
import { Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Field,
  Loading,
  Notice,
  Screen,
  styles,
  Title,
  useAction,
} from "../components/ui";
import { Choice } from "../components/Choice";
import { DocumentPreview } from "../components/DocumentPreview";
import { useDocuments } from "../providers/DocumentProvider";
import { useFinance } from "../providers/FinanceProvider";
import { useAuth } from "../providers/AuthProvider";
import { DOCUMENT_LIMIT } from "../core/documents";
import { readPickedFile } from "../services/documentFiles";
export default function Documents() {
  const { vendorId: initialVendor, paymentId: initialPayment } =
    useLocalSearchParams<{ vendorId?: string; paymentId?: string }>();
  const store = useDocuments(),
    finance = useFinance(),
    { isDemo } = useAuth(),
    action = useAction();
  const [query, setQuery] = useState(""),
    [vendorId, setVendor] = useState(initialVendor ?? ""),
    [paymentId, setPayment] = useState(initialPayment ?? "");
  const [confirm, setConfirm] = useState<string | null>(null),
    [preview, setPreview] = useState<{ url: string; name: string } | null>(
      null,
    ),
    [pickerError, setPickerError] = useState("");
  const [onlyLinked, setOnlyLinked] = useState(!!initialVendor);
  if (store.loading) return <Loading />;
  const linkedPayments = finance.payments.filter(
    (p) => p.vendor_id === vendorId,
  );
  const filtered = store.documents
    .filter(
      (d) =>
        (!onlyLinked || !vendorId || d.vendor_id === vendorId) &&
        (!onlyLinked || !paymentId || d.payment_id === paymentId) &&
        d.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  async function choose() {
    setPickerError("");
    try {
      // Keep the system picker in the original click gesture, including on Web.
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > DOCUMENT_LIMIT)
        throw Error("יש לבחור קובץ עד 5MB.");
      void action.run(async () => {
        const bytes = await readPickedFile(asset);
        await store.upload(
          asset.name,
          asset.mimeType ?? "",
          bytes,
          vendorId || null,
          paymentId || null,
        );
        setPreview(null);
      });
    } catch (e) {
      setPickerError(e instanceof Error ? e.message : "בחירת הקובץ נכשלה.");
    }
  }
  return (
    <Screen>
      <Button
        title="חזרה לבית"
        secondary
        onPress={() => router.dismissTo("/")}
      />
      <Title>הניירת מסודרת. הראש שקט.</Title>
      <Text style={styles.muted}>
        חוזים וקבלות, פרטיים למרחב שלכם. PDF, PNG או JPEG עד 5MB; עד 100 מסמכים
        למרחב.
      </Text>
      {isDemo && (
        <Notice text="בפיתוח המסמכים נשמרים במכשיר הזה בלבד, בכפוף למקום האחסון. בחשבון אמיתי הם נשמרים באחסון פרטי בענן." />
      )}
      <Card>
        <Text style={styles.heading}>הוספת מסמך</Text>
        <Choice
          label="שיוך לספק"
          value={vendorId}
          options={[
            { value: "", label: "ללא שיוך" },
            ...finance.vendors.map((v) => ({ value: v.id, label: v.name })),
          ]}
          onChange={(id) => {
            setVendor(id);
            setPayment("");
          }}
        />
        {!!vendorId && (
          <Choice
            label="שיוך לתשלום"
            value={paymentId}
            options={[
              { value: "", label: "ללא שיוך לתשלום" },
              ...linkedPayments.map((p) => ({ value: p.id, label: p.label })),
            ]}
            onChange={setPayment}
          />
        )}
        <Button
          title="בחירת קובץ והעלאה"
          busy={action.busy}
          disabled={!!store.error || !!finance.error || finance.loading}
          onPress={() => {
            void choose();
          }}
        />
        <Notice text={pickerError || action.message || store.error} error />
        {!!store.error && (
          <Button
            title="טעינה מחדש של מסמכים"
            secondary
            onPress={() => {
              void store.reload();
            }}
          />
        )}
      </Card>
      {preview && (
        <Card>
          <Text style={styles.heading}>{preview.name}</Text>
          <DocumentPreview url={preview.url} name={preview.name} />
          <Button
            title="סגירת תצוגת המסמך"
            secondary
            onPress={() => setPreview(null)}
          />
        </Card>
      )}
      <Field label="חיפוש מסמכים" value={query} onChangeText={setQuery} />
      {!!vendorId && (
        <Button
          title={onlyLinked ? "הצגת כל המסמכים" : "הצגת מסמכים המשויכים לבחירה"}
          secondary
          onPress={() => setOnlyLinked(!onlyLinked)}
        />
      )}
      {!filtered.length && (
        <Card>
          <Text style={styles.heading}>עוד קצת סדר, והכול כאן</Text>
          <Text style={styles.muted}>
            {query
              ? "לא נמצאו מסמכים לחיפוש הזה."
              : "אפשר להתחיל מחוזה המקום או מהקבלה הראשונה."}
          </Text>
        </Card>
      )}
      {filtered.map((doc) => (
        <Card key={doc.id}>
          <Text style={styles.heading}>{doc.name}</Text>
          <Text style={styles.muted}>
            {Math.ceil(doc.size_bytes / 1024)} KB ·{" "}
            {finance.vendors.find((v) => v.id === doc.vendor_id)?.name ??
              "מסמך כללי"}
            {doc.payment_id
              ? ` · ${finance.payments.find((p) => p.id === doc.payment_id)?.label ?? "תשלום"}`
              : ""}
          </Text>
          <Button
            title={`פתיחת מסמך: ${doc.name}`}
            secondary
            disabled={action.busy}
            onPress={() => {
              void action.run(async () => {
                const url = await store.open(doc);
                if (url) setPreview({ url, name: doc.name });
              });
            }}
          />
          {confirm === doc.id ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.error}>
                המחיקה תסיר את הקובץ גם עבור בן או בת הזוג.
              </Text>
              <Button
                title={`אישור מחיקת מסמך: ${doc.name}`}
                busy={action.busy}
                onPress={() => {
                  void action.run(async () => {
                    await store.remove(doc);
                    setConfirm(null);
                    setPreview(null);
                  });
                }}
              />
              <Button
                title="ביטול מחיקת המסמך"
                secondary
                disabled={action.busy}
                onPress={() => setConfirm(null)}
              />
            </View>
          ) : (
            <Button
              title={`מחיקת מסמך: ${doc.name}`}
              secondary
              disabled={action.busy}
              onPress={() => setConfirm(doc.id)}
            />
          )}
        </Card>
      ))}
    </Screen>
  );
}
