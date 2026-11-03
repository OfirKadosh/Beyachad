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
  styles,
  Title,
  useAction,
} from "../components/ui";
import { Choice } from "../components/Choice";
import { FinanceBoundary } from "../components/FinanceBoundary";
import { moneyInput, parseMoney } from "../core/money";
import { localDateKey } from "../core/tasks";
import { useFinance } from "../providers/FinanceProvider";
export default function PaymentEditor() {
  const { vendorId, id } = useLocalSearchParams<{
    vendorId: string;
    id?: string;
  }>();
  return (
    <FinanceBoundary>
      <Form key={id ?? vendorId} vendorId={vendorId} id={id} />
    </FinanceBoundary>
  );
}
function Form({ vendorId, id }: { vendorId: string; id?: string }) {
  const finance = useFinance();
  const action = useAction();
  const [vendor] = useState(() =>
    finance.vendors.find((v) => v.id === vendorId),
  );
  const [original] = useState(
    () =>
      finance.payments.find((p) => p.id === id && p.vendor_id === vendorId) ??
      null,
  );
  const [writeId] = useState(() => id ?? Crypto.randomUUID());
  const [label, setLabel] = useState(original?.label ?? "");
  const [amount, setAmount] = useState(
    moneyInput(original?.amount_cents ?? null),
  );
  const [mode, setMode] = useState<"planned" | "paid">(
    original?.paid_date ? "paid" : "planned",
  );
  const [due, setDue] = useState(original?.due_date ?? "");
  const [paid, setPaid] = useState(original?.paid_date ?? localDateKey());
  const [confirm, setConfirm] = useState(false);
  const changed =
    vendor?.version !==
      finance.vendors.find((v) => v.id === vendorId)?.version ||
    (!!original &&
      finance.payments.find((p) => p.id === id)?.version !== original.version);
  function exit() {
    router.dismissTo({ pathname: "/vendor-detail", params: { id: vendorId } });
  }
  if (!vendor || (id && !original))
    return (
      <Screen>
        <Title>הרישום אינו ברשימה</Title>
        <Button
          title="חזרה לספקים"
          onPress={() => router.dismissTo("/vendors")}
        />
      </Screen>
    );
  return (
    <Screen>
      <Button
        title="חזרה לכרטיס הספק ללא שמירה"
        secondary
        disabled={action.busy}
        onPress={exit}
      />
      <Title>{original ? "עריכת רישום תשלום" : "תשלום או מקדמה"}</Title>
      <Text style={styles.muted}>
        {vendor.name} · זהו תיעוד למעקב; האפליקציה אינה מעבירה כסף.
      </Text>
      {changed && (
        <Notice
          text="נתוני הספק או התשלום השתנו. פתחו את הרישום מחדש לפני שמירה."
          error
        />
      )}
      <Card>
        <Field
          label="תיאור התשלום"
          value={label}
          onChangeText={setLabel}
          maxLength={100}
          placeholder="למשל, מקדמה"
        />
        <Field
          label="סכום התשלום בשקלים"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <Choice<"planned" | "paid">
          label="מצב התשלום"
          value={mode}
          options={[
            { value: "planned", label: "מתוכנן" },
            { value: "paid", label: "שולם" },
          ]}
          onChange={setMode}
        />
        <Field
          label="מועד מתוכנן"
          value={due}
          onChangeText={setDue}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          maxLength={10}
        />
        {mode === "paid" && (
          <Field
            label="תאריך ששולם"
            value={paid}
            onChangeText={setPaid}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            maxLength={10}
          />
        )}
        <Button
          title="שמירת רישום תשלום"
          busy={action.busy}
          disabled={changed}
          onPress={() => {
            void action.run(async () => {
              if (mode === "paid" && !paid.trim())
                throw Error("יש להזין תאריך תשלום.");
              await finance.savePayment(writeId, vendor, original, {
                label,
                amount_cents: parseMoney(amount, true)!,
                due_date: due || null,
                paid_date: mode === "paid" ? paid : null,
              });
              exit();
            });
          }}
        />
        <Notice text={action.message} error />
      </Card>
      {original && (
        <Button
          title="מסמכים המשויכים לתשלום"
          secondary
          onPress={() =>
            router.push({
              pathname: "/documents",
              params: { vendorId, paymentId: original.id },
            })
          }
        />
      )}
      {original && (
        <Card>
          <Text style={styles.heading}>מחיקת הרישום</Text>
          <Text style={styles.muted}>
            מחיקת רישום אינה מבטלת תשלום שבוצע בפועל.
          </Text>
          {confirm ? (
            <>
              <Button
                title="אישור מחיקת רישום התשלום"
                disabled={changed}
                busy={action.busy}
                onPress={() => {
                  void action.run(async () => {
                    await finance.deletePayment(vendor, original);
                    exit();
                  });
                }}
              />
              <Button
                title="ביטול מחיקת הרישום"
                secondary
                onPress={() => setConfirm(false)}
              />
            </>
          ) : (
            <Button
              title="מחיקת רישום תשלום"
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
