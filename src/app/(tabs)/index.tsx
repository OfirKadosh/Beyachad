import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { daysUntil } from "../../core/wedding";
import { useReminders } from "../../providers/ReminderProvider";
import { useMeetings } from "../../providers/MeetingProvider";
import { formatMeetingTime } from "../../core/meetingTime";
import { useGuests } from "../../providers/GuestProvider";
import { guestTotals } from "../../core/guests";
import { useFinance } from "../../providers/FinanceProvider";
import { budgetTotals } from "../../core/finance";
import { money } from "../../core/money";
import { router } from "expo-router";
import { Text, View } from "react-native";
import {
  colors,
  Progress,
  Button,
  Card,
  Notice,
  Screen,
  styles,
  Title,
  useAction,
} from "../../components/ui";
import { recommendations, weddingTitle } from "../../core/domain";
import {
  assigneeLabel,
  formatDueDate,
  isOverdue,
  selectTasks,
} from "../../core/tasks";
import { useWedding } from "../../providers/WeddingProvider";
import { useAuth } from "../../providers/AuthProvider";
export default function Home() {
  const { wedding, tasks, viewerSlot, addTask } = useWedding();
  const { isDemo } = useAuth();
  const action = useAction();
  const finance = useFinance();
  const calendar = useMeetings();
  const { now } = useReminders();
  const nextMeetings = calendar.meetings
    .filter((m) => m.status === "scheduled" && Date.parse(m.starts_at) >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 2);
  const guests = useGuests();
  const people = guestTotals(guests.guests);
  const budget = budgetTotals(
    finance,
    wedding?.budget == null ? null : Math.round(wedding.budget * 100),
  );
  const days = daysUntil(wedding?.wedding_date ?? null, new Date(now));
  const done = tasks.filter((t) => t.completed).length;
  const nextPayments = finance.payments
    .filter((p) => !p.paid_date && p.due_date)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
    .slice(0, 2);
  const open = tasks.filter((t) => !t.completed);
  const upcoming = selectTasks(tasks, {
    filter: "open",
    query: "",
    sort: "due",
    viewer: viewerSlot,
  }).slice(0, 3);
  const overdue = open.filter((t) => isOverdue(t)).length;
  return (
    <Screen>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.muted}>{weddingTitle(wedding)}</Text>
          <Title>מתכננים את היום שלכם.</Title>
        </View>
        <Button
          title="הגדרות"
          secondary
          onPress={() => router.push("/settings")}
        />
      </View>
      {isDemo && (
        <Notice text="מצב פיתוח מחובר · שמירה מקומית · ללא סנכרון בין מכשירים" />
      )}
      <LinearGradient
        colors={["#087F79", "#315D87", "#7050B5"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ padding: 24, borderRadius: 28, gap: 14, overflow: "hidden" }}
      >
        <View
          style={{
            position: "absolute",
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: "#FFFFFF0C",
            left: -60,
            top: -50,
          }}
          pointerEvents="none"
        />
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Text style={[styles.muted, { color: "#E5F5F2" }]}>
            כל צעד קטן מקרב אתכם
          </Text>
          <Ionicons name="sparkles" color="#FFE0AB" size={25} />
        </View>
        <Text
          style={{
            fontSize: days === null ? 27 : 58,
            fontWeight: "800",
            color: "white",
            textAlign: "right",
          }}
        >
          {days === null
            ? "היום שלכם בדרך"
            : days > 0
              ? days
              : days === 0
                ? "זה היום שלכם!"
                : "איזה כיף, התחתנתם!"}
        </Text>
        <Text style={[styles.text, { color: "white" }]}>
          {days === null
            ? "נבחר תאריך ונתחיל לספור ביחד."
            : days > 0
              ? "ימים עד שאומרים כן"
              : days === 0
                ? "מאחלים לכם יום מלא אהבה."
                : "כל התכנון והזיכרונות נשארים כאן."}
        </Text>
        <Button
          title={
            wedding?.wedding_date
              ? "עדכון פרטי החתונה"
              : "בחירת תאריך ופרטי החתונה"
          }
          secondary
          onPress={() => router.push("/wedding-details")}
        />
      </LinearGradient>
      <View style={[styles.row, { alignItems: "stretch" }]}>
        <View
          style={{
            flex: 1,
            minWidth: 115,
            backgroundColor: colors.lavender,
            padding: 17,
            borderRadius: 22,
            gap: 6,
          }}
        >
          <Ionicons name="checkmark-circle" color={colors.purple} size={24} />
          <Text style={[styles.heading, { fontSize: 26 }]}>
            {done}/{tasks.length}
          </Text>
          <Text style={styles.muted}>משימות הושלמו</Text>
          <Progress
            value={tasks.length ? done / tasks.length : 0}
            label="התקדמות המשימות"
            color={colors.purple}
          />
        </View>
        <View
          style={{
            flex: 1,
            minWidth: 115,
            backgroundColor: colors.peach,
            padding: 17,
            borderRadius: 22,
            gap: 6,
          }}
        >
          <Ionicons name="people" color={colors.coral} size={24} />
          <Text style={[styles.heading, { fontSize: 26 }]}>
            {people.confirmed}
          </Text>
          <Text style={styles.muted}>יחגגו איתכם</Text>
          <Progress
            value={people.invited ? people.confirmed / people.invited : 0}
            label="אישורי הגעה"
            color={colors.coral}
          />
        </View>
      </View>
      <Button title="למשימות שלנו" onPress={() => router.push("/tasks")} />
      {!finance.loading && !finance.error && (
        <Card>
          <Text style={styles.heading}>הכסף שלנו בתמונה אחת</Text>
          <Text style={styles.text}>
            התחייבנו: {money(budget.committed)} · שולם: {money(budget.paid)}
          </Text>
          <Text style={styles.muted}>
            נותר לתשלום: {money(budget.remaining)}
          </Text>
          <Progress
            value={budget.committed ? budget.paid / budget.committed : 0}
            label="התקדמות התשלומים"
          />
          {nextPayments.map((p) => (
            <View key={p.id} style={{ gap: 5 }}>
              <Text style={styles.text}>
                {p.label} · {money(p.amount_cents)}
              </Text>
              <Text style={styles.muted}>{formatDueDate(p.due_date)}</Text>
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
            </View>
          ))}
          {budget.available !== null && budget.available < 0 && (
            <Notice
              text={`חריגה מיעד התקציב: ${money(-budget.available)}`}
              error
            />
          )}
          <Button
            title="לפרטי התקציב"
            secondary
            onPress={() => router.navigate("/budget")}
          />
        </Card>
      )}
      {!guests.loading && !guests.error && (
        <Card>
          <Text style={styles.heading}>האנשים שיחגגו איתנו</Text>
          <Text style={styles.text}>
            {people.confirmed} מאשרים מתוך {people.invited} מוזמנים
          </Text>
          <Text style={styles.muted}>
            {people.invitations} הזמנות · {people.pending} אנשים טרם השיבו
          </Text>
          <Button
            title="לרשימת המוזמנים"
            secondary
            onPress={() => router.navigate("/guests")}
          />
        </Card>
      )}
      <Card>
        <Text style={styles.heading}>הפגישות והתזכורות שלנו</Text>
        <Button
          title="לניהול הפגישות"
          secondary
          onPress={() => router.navigate("/meetings")}
        />
        <Button
          title="לתזכורות שלי"
          secondary
          onPress={() => router.navigate("/reminders")}
        />
        {nextMeetings.map((m) => (
          <View key={m.id}>
            <Text style={styles.text}>{m.title}</Text>
            <Text style={styles.muted}>
              {formatMeetingTime(m.starts_at, m.time_zone)} · {m.time_zone}
            </Text>
          </View>
        ))}
      </Card>
      {upcoming.length > 0 && (
        <Card>
          <Text accessibilityRole="header" style={styles.heading}>
            הצעדים הקרובים
          </Text>
          {overdue > 0 && (
            <Notice text={`${overdue} משימות עברו את תאריך היעד`} error />
          )}
          {upcoming.map((task) => (
            <View key={task.id} style={{ gap: 6 }}>
              <Text style={styles.text}>{task.title}</Text>
              <Text style={styles.muted}>
                {formatDueDate(task.due_date)} ·{" "}
                {assigneeLabel(task.owner, wedding, viewerSlot)}
              </Text>
              <Button
                title={`פתיחת משימה: ${task.title}`}
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/task-editor",
                    params: { id: task.id },
                  })
                }
              />
            </View>
          ))}
        </Card>
      )}
      <Card>
        <Text style={styles.heading}>כל המסמכים, במקום אחד</Text>
        <Text style={styles.muted}>
          חוזים, הצעות וקבלות — מסודרים ופרטיים לשניכם.
        </Text>
        <Button
          title="למסמכים שלנו"
          secondary
          onPress={() => router.push("/documents")}
        />
      </Card>
      <Text accessibilityRole="header" style={styles.heading}>
        מומלץ להתחיל כאן
      </Text>
      <Notice text={action.message} error />
      {recommendations.map((item) => {
        const added = tasks.some((t) => t.recommendation_key === item.key);
        return (
          <Card key={item.key}>
            <Text style={styles.heading}>{item.title}</Text>
            <Text style={styles.muted}>{item.detail}</Text>
            <Button
              title={added ? "נוסף לרשימת המשימות ✓" : "הוספה למשימות שלנו"}
              secondary
              disabled={added || action.busy}
              onPress={() => {
                void action.run(() => addTask(item.title, item.key));
              }}
            />
          </Card>
        );
      })}
    </Screen>
  );
}
