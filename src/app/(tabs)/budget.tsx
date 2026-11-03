import { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Card,
  Field,
  Notice,
  Screen,
  styles,
  Title,
  useAction,
} from "../../components/ui";
import { FinanceBoundary } from "../../components/FinanceBoundary";
import {
  budgetTotals,
  vendorCategories,
  vendorTotals,
} from "../../core/finance";
import { money, moneyInput, parseMoney } from "../../core/money";
import { formatDueDate } from "../../core/tasks";
import { useFinance } from "../../providers/FinanceProvider";
import { useWedding } from "../../providers/WeddingProvider";
import type { Wedding } from "../../core/domain";
export default function Budget() {
  return (
    <FinanceBoundary>
      <Content />
    </FinanceBoundary>
  );
}
function Content() {
  const finance = useFinance();
  const { wedding } = useWedding();
  const action = useAction();
  const [editing, setEditing] = useState(false);
  const [baseline, setBaseline] = useState<Wedding | null>(null);
  const [target, setTarget] = useState("");
  const totals = budgetTotals(
    finance,
    wedding?.budget == null ? null : Math.round(wedding.budget * 100),
  );
  const planned = finance.payments
    .filter((p) => !p.paid_date)
    .sort(
      (a, b) =>
        (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
        a.id.localeCompare(b.id),
    );
  return (
    <Screen>
      <Title>התקציב שלנו</Title>
      <Card hero>
        <Text style={styles.muted}>יעד התקציב</Text>
        <Text style={styles.title}>
          {wedding?.budget == null
            ? "טרם הוגדר"
            : money(Math.round(wedding.budget * 100))}
        </Text>
        <Button
          title="עדכון יעד התקציב"
          secondary
          disabled={action.busy}
          onPress={() => {
            setBaseline(wedding);
            setTarget(
              moneyInput(
                wedding?.budget == null
                  ? null
                  : Math.round(wedding.budget * 100),
              ),
            );
            setEditing(true);
          }}
        />
      </Card>
      {editing && (
        <Card>
          <Field
            label="יעד תקציב בשקלים"
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
            placeholder="אפשר להשאיר ריק"
          />
          <Button
            title="שמירת יעד התקציב"
            busy={action.busy}
            onPress={() => {
              void action.run(async () => {
                if (!baseline) throw Error("יש להגדיר חתונה תחילה.");
                const cents = parseMoney(target);
                await finance.setBudget(
                  baseline,
                  cents === null ? null : cents / 100,
                );
                setEditing(false);
              });
            }}
          />
          <Button
            title="ביטול עדכון התקציב"
            secondary
            disabled={action.busy}
            onPress={() => setEditing(false)}
          />
          <Notice text={action.message} error />
        </Card>
      )}
      <Card>
        <Text style={styles.heading}>
          התחייבויות שסגרנו: {money(totals.committed)}
        </Text>
        <Text style={styles.text}>שולם בפועל: {money(totals.paid)}</Text>
        <Text style={styles.text}>יתרה לתשלום: {money(totals.remaining)}</Text>
        <Text style={styles.muted}>
          מתוך היתרה, {money(totals.scheduled)} כבר מתוכננים לתשלום.
        </Text>
        {totals.available !== null && (
          <Text style={totals.available < 0 ? styles.error : styles.text}>
            {totals.available < 0
              ? `חריגה מיעד התקציב: ${money(-totals.available)}`
              : `תקציב שטרם התחייבנו עליו: ${money(totals.available)}`}
          </Text>
        )}
        <Text style={styles.muted}>
          הצעות מחיר של ספקים שטרם נסגרו אינן התחייבות ואינן נספרות כאן.
        </Text>
      </Card>
      <Text style={styles.heading}>התחייבויות לפי קטגוריה</Text>
      {Object.entries(vendorCategories).map(([key, label]) => {
        const amount = finance.vendors
          .filter((v) => v.category === key)
          .reduce(
            (sum, v) => sum + vendorTotals(v, finance.payments).committed,
            0,
          );
        return amount > 0 ? (
          <Text key={key} style={styles.text}>
            {label}: {money(amount)}
          </Text>
        ) : null;
      })}
      {!finance.vendors.some((v) => v.status === "booked") && (
        <Text style={styles.muted}>לא נסגרו עדיין ספקים.</Text>
      )}
      <Button
        title="לניהול הספקים"
        secondary
        onPress={() => router.navigate("/vendors")}
      />
      <Text style={styles.heading}>תשלומים מתוכננים</Text>
      {totals.overdue > 0 && (
        <Notice
          text={`${totals.overdue} תשלומים עברו את המועד המתוכנן`}
          error
        />
      )}
      {!planned.length && (
        <Text style={styles.muted}>אין כרגע תשלומים מתוכננים.</Text>
      )}
      {planned.map((p) => (
        <Card key={p.id}>
          <Text style={styles.heading}>
            {p.label} · {money(p.amount_cents)}
          </Text>
          <Text style={styles.muted}>
            {finance.vendors.find((v) => v.id === p.vendor_id)?.name} ·{" "}
            {formatDueDate(p.due_date)}
          </Text>
          <Button
            title={`פתיחת תשלום: ${p.label}`}
            secondary
            onPress={() =>
              router.push({
                pathname: "/payment-editor",
                params: { id: p.id, vendorId: p.vendor_id },
              })
            }
          />
        </Card>
      ))}
    </Screen>
  );
}
