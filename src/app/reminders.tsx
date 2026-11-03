import { formatDueDate } from "../core/tasks";
import { useState } from "react";
import { Linking, Text } from "react-native";
import { router, type Href } from "expo-router";
import {
  Button,
  Card,
  Notice,
  Screen,
  styles,
  Title,
  useAction,
} from "../components/ui";
import { Choice } from "../components/Choice";
import { useReminders } from "../providers/ReminderProvider";
import { formatMeetingTime, meetingWallTime } from "../core/meetingTime";
const labels = { meeting: "פגישה", task: "משימה", payment: "תשלום" };
export default function Reminders() {
  const store = useReminders(),
    action = useAction();
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const shown = store.items.filter(
    (i) =>
      filter === "all" ||
      (filter === "past" ? i.eventAt < store.now : i.eventAt >= store.now),
  );
  return (
    <Screen>
      <Button
        title="חזרה לבית"
        secondary
        onPress={() => router.dismissTo("/")}
      />
      <Title>התזכורות שלי</Title>
      <Text style={styles.muted}>
        פגישות ומשימות באחריותך או באחריות שניכם, ותשלומים משותפים.
      </Text>
      <Card hero>
        <Text style={styles.heading}>התראות במכשיר הזה</Text>
        <Text style={styles.muted}>
          {store.supported
            ? store.enabled
              ? `תוזמנו ${store.count} התראות קרובות במכשיר.`
              : "התראות המכשיר כבויות. הרשימה בתוך האפליקציה זמינה תמיד."
            : "בדפדפן משתמשים ברשימה הזו. התראות מכשיר זמינות באפליקציה מותקנת באייפון או באנדרואיד."}
        </Text>
        <Button
          title={store.enabled ? "כיבוי התראות במכשיר" : "הפעלת התראות במכשיר"}
          disabled={!store.supported}
          busy={action.busy}
          onPress={() => {
            void action.run(() => store.setEnabled(!store.enabled));
          }}
        />
        {store.status === "denied" && (
          <>
            <Notice text="הרשאת ההתראות אינה פעילה בהגדרות המכשיר." error />
            <Button
              title="פתיחת הגדרות המכשיר"
              secondary
              onPress={() => {
                void action.run(() => Linking.openSettings());
              }}
            />
          </>
        )}
        <Text style={styles.muted}>
          פגישות — לפי התזכורת שבחרתם. משימות ותשלומים — ביום היעד ב־09:00 לפי{" "}
          {store.zone}. מתוזמנות עד 50 ההתראות העתידיות הקרובות; שאר הפריטים
          נשארים ברשימה.
        </Text>
        <Text style={styles.muted}>
          פתחו את האפליקציה לאחר שינויים ממכשיר אחר כדי לעדכן את ההתראות במכשיר
          הזה. תוכן ההתראה במסך הנעילה כללי.
        </Text>
      </Card>
      <Notice text={store.error || action.message} error />
      <Button
        title="רענון התזכורות"
        secondary
        busy={action.busy}
        onPress={() => {
          void action.run(store.refresh);
        }}
      />
      <Choice<"upcoming" | "past" | "all">
        label="הצגת תזכורות"
        value={filter}
        options={[
          { value: "upcoming", label: "קרובות" },
          { value: "past", label: "מועד עבר" },
          { value: "all", label: "הכול" },
        ]}
        onChange={setFilter}
      />
      {!shown.length && (
        <Card>
          <Text style={styles.heading}>אין פריטים בתצוגה הזו</Text>
          <Text style={styles.muted}>
            הגדירו פגישה, תאריך יעד למשימה או תשלום מתוכנן.
          </Text>
        </Card>
      )}
      {shown.map((item) => (
        <Card key={item.key}>
          <Text style={styles.heading}>{item.title}</Text>
          <Text style={styles.muted}>
            {labels[item.kind]} ·{" "}
            {item.kind === "meeting"
              ? formatMeetingTime(
                  new Date(item.eventAt).toISOString(),
                  store.zone,
                )
              : formatDueDate(
                  meetingWallTime(
                    new Date(item.eventAt).toISOString(),
                    store.zone,
                  ).date,
                )}
          </Text>
          <Button
            title={`פתיחת תזכורת: ${item.title}`}
            secondary
            onPress={() => router.push(item.href as Href)}
          />
        </Card>
      ))}
    </Screen>
  );
}
