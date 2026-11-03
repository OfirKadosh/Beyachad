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
import { GuestBoundary } from "../../components/GuestBoundary";
import {
  guestSideLabel,
  guestTotals,
  rsvpLabels,
  selectGuests,
  type GuestDraft,
} from "../../core/guests";
import { useGuests } from "../../providers/GuestProvider";
import { useWedding } from "../../providers/WeddingProvider";
export default function Guests() {
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  return (
    <GuestBoundary>
      <List key={saved ?? "initial"} />
    </GuestBoundary>
  );
}
function List() {
  const { guests } = useGuests();
  const { wedding, viewerSlot } = useWedding();
  const [query, setQuery] = useState("");
  const [rsvp, setRsvp] = useState<GuestDraft["rsvp"] | "all">("all");
  const [side, setSide] = useState<GuestDraft["side"] | "all">("all");
  const [group, setGroup] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const totals = guestTotals(guests);
  const shown = selectGuests(guests, { query, rsvp, side, group });
  const groups = [
    ...new Set(guests.map((g) => g.group_name).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "he"));
  return (
    <Screen>
      <Title>המוזמנים שלנו</Title>
      <Card hero>
        <Text style={styles.heading}>סיכום הרשימה כולה</Text>
        <Text style={styles.text}>
          {totals.invitations} הזמנות · {totals.invited} אנשים מוזמנים
        </Text>
        <Text style={styles.muted}>
          {totals.invited_adults} מבוגרים · {totals.invited_children} ילדים
        </Text>
        <Text style={styles.text}>אישרו הגעה: {totals.confirmed} אנשים</Text>
        <Text style={styles.muted}>
          {totals.confirmed_adults} מבוגרים ו־{totals.confirmed_children} ילדים
          אישרו
        </Text>
        <Text style={styles.muted}>
          טרם השיבו: {totals.pending} אנשים ב־{totals.pending_invitations}{" "}
          הזמנות
        </Text>
        <Text style={styles.muted}>
          לא יגיעו: {totals.declined} אנשים, כולל מי שלא אישרו בהזמנה שאושרה
          חלקית
        </Text>
      </Card>
      <Button
        title="הוספת הזמנה"
        onPress={() => router.push("/guest-editor")}
      />
      <Field
        label="חיפוש מוזמנים"
        value={query}
        onChangeText={setQuery}
        placeholder="שם, טלפון, קבוצה או צורך תזונתי"
      />
      <Choice<GuestDraft["rsvp"] | "all">
        label="מצב אישורי הגעה"
        value={rsvp}
        options={[
          { value: "all", label: "הכול" },
          ...Object.entries(rsvpLabels).map(([value, label]) => ({
            value: value as GuestDraft["rsvp"],
            label,
          })),
        ]}
        onChange={setRsvp}
      />
      <Button
        title={advanced ? "סגירת סינון לפי צד וקבוצה" : "סינון לפי צד וקבוצה"}
        secondary
        onPress={() => setAdvanced(!advanced)}
      />
      {advanced && (
        <Card>
          <Choice<GuestDraft["side"] | "all">
            label="צד ברשימת המוזמנים"
            value={side}
            options={[
              { value: "all", label: "הכול" },
              ...(["one", "two", "shared"] as const).map((value) => ({
                value,
                label: guestSideLabel(value, wedding, viewerSlot),
              })),
            ]}
            onChange={setSide}
          />
          {groups.length > 0 && (
            <Choice<string>
              label="קבוצת מוזמנים"
              value={group}
              options={[
                { value: "", label: "הכול" },
                ...groups.map((value) => ({ value, label: value })),
              ]}
              onChange={setGroup}
            />
          )}
        </Card>
      )}
      <Text style={styles.muted}>
        מוצגות {shown.length} הזמנות מתוך {guests.length}
      </Text>
      {!shown.length && (
        <Card>
          <Text style={styles.heading}>
            {guests.length
              ? "לא נמצאו הזמנות בסינון הזה"
              : "מתחילים ברשימת האנשים החשובים לכם"}
          </Text>
          <Text style={styles.muted}>
            {guests.length
              ? "אפשר לשנות את החיפוש או הסינון."
              : "מוסיפים הזמנה למשפחה, לזוג או לאדם יחיד."}
          </Text>
        </Card>
      )}
      {shown.map((guest) => {
        const invited = guest.invited_adults + guest.invited_children,
          confirmed = guest.confirmed_adults + guest.confirmed_children;
        return (
          <Card key={guest.id}>
            <Text style={styles.heading}>{guest.name}</Text>
            <Text style={styles.muted}>
              {guestSideLabel(guest.side, wedding, viewerSlot)}
              {guest.group_name ? ` · ${guest.group_name}` : ""}
            </Text>
            <Text style={styles.text}>
              {invited} מוזמנים · {guest.invited_adults} מבוגרים ו־
              {guest.invited_children} ילדים
            </Text>
            <Text style={styles.text}>
              {rsvpLabels[guest.rsvp]}
              {guest.rsvp === "confirmed"
                ? ` · ${confirmed} מתוך ${invited}${confirmed < invited ? " · אישור חלקי" : ""}`
                : ""}
            </Text>
            {!!guest.contact && (
              <Text style={styles.muted}>איש קשר: {guest.contact}</Text>
            )}
            {!!guest.phone && (
              <Text selectable style={styles.muted}>
                {guest.phone}
              </Text>
            )}
            {!!guest.dietary && (
              <Text numberOfLines={2} style={styles.muted}>
                צרכים תזונתיים: {guest.dietary}
              </Text>
            )}
            <Button
              title={`עריכת הזמנה: ${guest.name}`}
              secondary
              onPress={() =>
                router.push({
                  pathname: "/guest-editor",
                  params: { id: guest.id },
                })
              }
            />
          </Card>
        );
      })}
    </Screen>
  );
}
