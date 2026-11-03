import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Field,
  Screen,
  styles,
  Title,
} from "../../components/ui";
import { Choice } from "../../components/Choice";
import { FinanceBoundary } from "../../components/FinanceBoundary";
import {
  vendorCategories,
  vendorStatuses,
  vendorTotals,
  type Vendor,
} from "../../core/finance";
import { money } from "../../core/money";
import { useFinance } from "../../providers/FinanceProvider";
export default function Vendors() {
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  return (
    <FinanceBoundary>
      <List key={saved ?? "initial"} />
    </FinanceBoundary>
  );
}
function List() {
  const { vendors, payments } = useFinance();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Vendor["status"]>("all");
  const shown = vendors
    .filter(
      (v) =>
        (filter === "all" || v.status === filter) &&
        `${v.name} ${v.contact} ${v.notes}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
  return (
    <Screen>
      <Title>הספקים שלנו</Title>
      <Text style={styles.muted}>
        מהצעת המחיר הראשונה ועד לסגירה. רק ספקים שנסגרו נכנסים לסך ההתחייבויות.
      </Text>
      <Button title="הוספת ספק" onPress={() => router.push("/vendor-editor")} />
      <Field
        label="חיפוש ספקים"
        value={query}
        onChangeText={setQuery}
        placeholder="שם, איש קשר או הערה"
      />
      <Choice<"all" | Vendor["status"]>
        label="מצב ספקים"
        value={filter}
        options={[
          { value: "all", label: "הכול" },
          ...Object.entries(vendorStatuses).map(([value, label]) => ({
            value: value as Vendor["status"],
            label,
          })),
        ]}
        onChange={setFilter}
      />
      {!shown.length && (
        <Card>
          <Text style={styles.heading}>
            {vendors.length
              ? "לא נמצאו ספקים בסינון הזה"
              : "עוד לא הוספתם ספקים"}
          </Text>
          <Text style={styles.muted}>אפשר להתחיל מהאולם, הצלם או המוזיקה.</Text>
        </Card>
      )}
      {shown.map((v) => {
        const totals = vendorTotals(v, payments);
        return (
          <Card key={v.id}>
            <Text style={styles.heading}>{v.name}</Text>
            <Text style={styles.muted}>
              {vendorCategories[v.category]} · {vendorStatuses[v.status]}
            </Text>
            <Text style={styles.text}>
              {v.status === "booked"
                ? `מחיר שסוכם: ${money(totals.committed)}`
                : `הצעת מחיר: ${v.quote_cents === null ? "טרם התקבלה" : money(v.quote_cents)}`}
            </Text>
            {v.status === "booked" && (
              <Text style={styles.muted}>
                שולם {money(totals.paid)} · נותר לתשלום{" "}
                {money(totals.remaining)}
              </Text>
            )}
            <Button
              title={`פתיחת ספק: ${v.name}`}
              secondary
              onPress={() =>
                router.push({
                  pathname: "/vendor-detail",
                  params: { id: v.id },
                })
              }
            />
          </Card>
        );
      })}
    </Screen>
  );
}
