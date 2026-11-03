import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Card, Screen, styles, Title } from "../components/ui";
import { FinanceBoundary } from "../components/FinanceBoundary";
import {
  vendorCategories,
  vendorStatuses,
  vendorTotals,
} from "../core/finance";
import { money } from "../core/money";
import { formatDueDate } from "../core/tasks";
import { useFinance } from "../providers/FinanceProvider";
export default function VendorDetail() {
  return (
    <FinanceBoundary>
      <Detail />
    </FinanceBoundary>
  );
}
function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { vendors, payments } = useFinance();
  const vendor = vendors.find((v) => v.id === id);
  if (!vendor)
    return (
      <Screen>
        <Title>הספק אינו ברשימה</Title>
        <Button
          title="חזרה לספקים"
          onPress={() => router.dismissTo("/vendors")}
        />
      </Screen>
    );
  const totals = vendorTotals(vendor, payments);
  const entries = payments
    .filter((p) => p.vendor_id === id)
    .sort(
      (a, b) =>
        (a.paid_date ?? a.due_date ?? "").localeCompare(
          b.paid_date ?? b.due_date ?? "",
        ) || a.id.localeCompare(b.id),
    );
  return (
    <Screen>
      <Button
        title="חזרה לרשימת הספקים"
        secondary
        onPress={() => router.dismissTo("/vendors")}
      />
      <Title>{vendor.name}</Title>
      <Text style={styles.muted}>
        {vendorCategories[vendor.category]} · {vendorStatuses[vendor.status]}
      </Text>
      <Card>
        <Text style={styles.text}>
          איש קשר: {vendor.contact || "טרם הוגדר"}
        </Text>
        <Text selectable style={styles.text}>
          טלפון: {vendor.phone || "טרם הוגדר"}
        </Text>
        <Text style={styles.text}>
          הצעת מחיר:{" "}
          {vendor.quote_cents === null
            ? "טרם התקבלה"
            : money(vendor.quote_cents)}
        </Text>
        {!!vendor.notes && <Text style={styles.text}>{vendor.notes}</Text>}
        <Button
          title="עריכת פרטי ספק"
          secondary
          onPress={() =>
            router.push({ pathname: "/vendor-editor", params: { id } })
          }
        />
      </Card>
      {vendor.status === "booked" && (
        <Card hero>
          <Text style={styles.heading}>
            מחיר שסוכם: {money(totals.committed)}
          </Text>
          <Text style={styles.text}>שולם בפועל: {money(totals.paid)}</Text>
          <Text style={styles.text}>
            יתרה לתשלום: {money(totals.remaining)}
          </Text>
          <Text style={styles.muted}>
            מתוך היתרה: {money(totals.scheduled)} בתשלומים מתוכננים,{" "}
            {money(totals.unscheduled)} ללא תכנון מועד.
          </Text>
          <Button
            title="הוספת רישום תשלום"
            onPress={() =>
              router.push({
                pathname: "/payment-editor",
                params: { vendorId: id },
              })
            }
          />
        </Card>
      )}
      <Text style={styles.heading}>תשלומים ומקדמות</Text>
      {!entries.length && (
        <Text style={styles.muted}>
          {vendor.status === "booked"
            ? "עדיין אין רישומי תשלום. אפשר להוסיף מקדמה או תשלום מתוכנן."
            : "כדי לתעד תשלומים יש לסגור מחיר עם הספק תחילה."}
        </Text>
      )}
      {entries.map((payment) => (
        <Card key={payment.id}>
          <Text style={styles.heading}>
            {payment.label} · {money(payment.amount_cents)}
          </Text>
          <Text style={styles.muted}>
            {payment.paid_date
              ? `שולם ב־${formatDueDate(payment.paid_date)}`
              : `מתוכנן ל־${formatDueDate(payment.due_date)}`}
          </Text>
          <Button
            title={`עריכת תשלום: ${payment.label}`}
            secondary
            onPress={() =>
              router.push({
                pathname: "/payment-editor",
                params: { vendorId: id, id: payment.id },
              })
            }
          />
        </Card>
      ))}
    </Screen>
  );
}
