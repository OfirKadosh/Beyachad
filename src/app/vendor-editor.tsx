import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  Button,
  Card,
  Field,
  Notice,
  Screen,
  Title,
  useAction,
  styles,
} from "../components/ui";
import { Choice } from "../components/Choice";
import { FinanceBoundary } from "../components/FinanceBoundary";
import {
  emptyVendor,
  vendorCategories,
  vendorStatuses,
  type VendorDraft,
} from "../core/finance";
import { moneyInput, parseMoney } from "../core/money";
import { useFinance } from "../providers/FinanceProvider";
export default function VendorEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <FinanceBoundary>
      <Form key={id ?? "new"} id={id} />
    </FinanceBoundary>
  );
}
function Form({ id }: { id?: string }) {
  const finance = useFinance();
  const action = useAction();
  const [original] = useState(
    () => finance.vendors.find((v) => v.id === id) ?? null,
  );
  const [writeId] = useState(() => id ?? Crypto.randomUUID());
  const [draft, setDraft] = useState<VendorDraft>(
    () => original ?? emptyVendor(),
  );
  const [quote, setQuote] = useState(moneyInput(original?.quote_cents ?? null));
  const [agreed, setAgreed] = useState(
    moneyInput(original?.agreed_cents ?? null),
  );
  const [confirm, setConfirm] = useState(false);
  const changed =
    !!original &&
    finance.vendors.find((v) => v.id === original.id)?.version !==
      original.version;
  function update<K extends keyof VendorDraft>(key: K, value: VendorDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function exit() {
    router.dismissTo("/vendors");
  }
  function saved() {
    router.dismissTo({
      pathname: "/vendors",
      params: { saved: String(Date.now()) },
    });
  }
  if (id && !original)
    return (
      <Screen>
        <Title>הספק אינו ברשימה</Title>
        <Button title="חזרה לספקים" onPress={exit} />
      </Screen>
    );
  return (
    <Screen>
      <Button
        title="חזרה לספקים ללא שמירה"
        secondary
        disabled={action.busy}
        onPress={exit}
      />
      <Title>{original ? "עריכת ספק" : "ספק חדש בדרך לחתונה"}</Title>
      {changed && (
        <Notice
          text="כרטיס הספק עודכן או נמחק. הטיוטה נשארת כאן; פתחו את הכרטיס מחדש לפני שמירה."
          error
        />
      )}
      <Card>
        <Field
          label="שם הספק"
          value={draft.name}
          onChangeText={(v) => update("name", v)}
          maxLength={100}
        />
        <Choice
          label="קטגוריית ספק"
          value={draft.category}
          options={Object.entries(vendorCategories).map(([value, label]) => ({
            value: value as VendorDraft["category"],
            label,
          }))}
          onChange={(v) => update("category", v)}
        />
        <Choice
          label="מצב הספק"
          value={draft.status}
          options={Object.entries(vendorStatuses).map(([value, label]) => ({
            value: value as VendorDraft["status"],
            label,
          }))}
          onChange={(v) => update("status", v)}
        />
        <Field
          label="איש קשר — רשות"
          value={draft.contact}
          onChangeText={(v) => update("contact", v)}
          maxLength={100}
        />
        <Field
          label="טלפון — רשות"
          value={draft.phone}
          onChangeText={(v) => update("phone", v)}
          keyboardType="phone-pad"
          maxLength={40}
        />
        <Field
          label="הצעת מחיר בשקלים — רשות"
          value={quote}
          onChangeText={setQuote}
          keyboardType="decimal-pad"
        />
        <Field
          label="מחיר שסוכם בשקלים"
          value={agreed}
          onChangeText={setAgreed}
          keyboardType="decimal-pad"
          placeholder="חובה כאשר הספק נסגר"
        />
        <Field
          label="הערות לספק — רשות"
          value={draft.notes}
          onChangeText={(v) => update("notes", v)}
          multiline
          numberOfLines={4}
          maxLength={2000}
        />
        <Button
          title="שמירת ספק"
          disabled={changed}
          busy={action.busy}
          onPress={() => {
            void action.run(async () => {
              await finance.saveVendor(writeId, original, {
                ...draft,
                quote_cents: parseMoney(quote),
                agreed_cents: parseMoney(agreed, draft.status === "booked"),
              });
              saved();
            });
          }}
        />
        <Notice text={action.message} error />
      </Card>
      {original && (
        <Card>
          <Text style={styles.heading}>מחיקת כרטיס הספק</Text>
          <Text style={styles.muted}>
            כרטיס עם רישומי תשלום לא יימחק עד שתטפלו בהם.
          </Text>
          {confirm ? (
            <>
              <Button
                title="אישור מחיקת הספק"
                disabled={changed}
                busy={action.busy}
                onPress={() => {
                  void action.run(async () => {
                    await finance.deleteVendor(original);
                    saved();
                  });
                }}
              />
              <Button
                title="ביטול מחיקת הספק"
                secondary
                onPress={() => setConfirm(false)}
              />
            </>
          ) : (
            <Button
              title="מחיקת ספק"
              secondary
              disabled={changed || action.busy}
              onPress={() => setConfirm(true)}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}
