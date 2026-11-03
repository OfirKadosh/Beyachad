import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Card, Field, Screen, styles, Title } from "../components/ui";
import { Choice } from "../components/Choice";
import { MeetingBoundary } from "../components/MeetingBoundary";
import { meetingStatuses, type Meeting } from "../core/meetings";
import { formatMeetingTime } from "../core/meetingTime";
import { assigneeLabel } from "../core/tasks";
import { useMeetings } from "../providers/MeetingProvider";
import { useWedding } from "../providers/WeddingProvider";
import { useFinance } from "../providers/FinanceProvider";
export default function Meetings() {
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  return (
    <MeetingBoundary>
      <List
        key={saved ?? "initial"}
        initialFilter={saved ? "all" : "scheduled"}
      />
    </MeetingBoundary>
  );
}
function List({ initialFilter }: { initialFilter: Meeting["status"] | "all" }) {
  const { meetings } = useMeetings(),
    { wedding, viewerSlot } = useWedding(),
    { vendors } = useFinance();
  const [filter, setFilter] = useState<Meeting["status"] | "all">(
      initialFilter,
    ),
    [query, setQuery] = useState("");
  const shown = meetings
    .filter(
      (m) =>
        (filter === "all" || m.status === filter) &&
        [m.title, m.location, m.notes]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id),
    );
  return (
    <Screen>
      <Button
        title="חזרה לבית"
        secondary
        onPress={() => router.dismissTo("/")}
      />
      <Title>הפגישות שלנו</Title>
      <Button
        title="פגישה חדשה"
        onPress={() =>
          router.push({
            pathname: "/meeting-editor",
            params: { fromList: "true" },
          })
        }
      />
      <Field
        label="חיפוש פגישות"
        value={query}
        onChangeText={setQuery}
        placeholder="כותרת, מקום או הערה"
      />
      <Choice<Meeting["status"] | "all">
        label="מצב פגישות"
        value={filter}
        options={[
          { value: "all", label: "הכול" },
          ...Object.entries(meetingStatuses).map(([value, label]) => ({
            value: value as Meeting["status"],
            label,
          })),
        ]}
        onChange={setFilter}
      />
      {!shown.length && (
        <Card>
          <Text style={styles.heading}>אין פגישות בתצוגה הזו</Text>
          <Text style={styles.muted}>
            אפשר לקבוע טעימות, פגישה עם צלם או מדידות.
          </Text>
        </Card>
      )}
      {shown.map((m) => (
        <Card key={m.id}>
          <Text style={styles.heading}>{m.title}</Text>
          <Text style={styles.text}>
            {formatMeetingTime(m.starts_at, m.time_zone)}
          </Text>
          <Text style={styles.muted}>
            {m.time_zone} · {m.duration_minutes} דקות ·{" "}
            {assigneeLabel(m.owner, wedding, viewerSlot)}
          </Text>
          <Text style={styles.muted}>
            {meetingStatuses[m.status]}
            {m.location ? ` · ${m.location}` : ""}
          </Text>
          {m.vendor_id && (
            <Text style={styles.muted}>
              ספק:{" "}
              {vendors.find((v) => v.id === m.vendor_id)?.name ?? "כרטיס ספק"}
            </Text>
          )}
          <Text style={styles.muted}>
            {m.reminder_minutes === null
              ? "ללא התראת מכשיר לפגישה"
              : m.reminder_minutes === 0
                ? "תזכורת בזמן הפגישה"
                : `תזכורת ${m.reminder_minutes} דקות לפני`}
          </Text>
          <Button
            title={`עריכת פגישה: ${m.title}`}
            secondary
            onPress={() =>
              router.push({
                pathname: "/meeting-editor",
                params: { id: m.id, fromList: "true" },
              })
            }
          />
        </Card>
      ))}
    </Screen>
  );
}
