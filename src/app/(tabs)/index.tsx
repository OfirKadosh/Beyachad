import { useGuests } from "../../providers/GuestProvider";
import { guestTotals } from "../../core/guests";
import { useFinance } from "../../providers/FinanceProvider";
import { budgetTotals } from "../../core/finance";
import { money } from "../../core/money";
import { router } from "expo-router";
import { Text, View } from "react-native";
import {
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
  const guests = useGuests();
  const people = guestTotals(guests.guests);
  const budget = budgetTotals(
    finance,
    wedding?.budget == null ? null : Math.round(wedding.budget * 100),
  );
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
      <Card hero>
        <Text style={styles.heading}>
          {wedding?.wedding_date
            ? `נפגשים ב־${wedding.wedding_date}`
            : "עוד לא קבעתם תאריך? יש זמן לתכנן."}
        </Text>
        <Text style={styles.text}>
          {open.length
            ? `${open.length} משימות פתוחות בדרך ליום שלכם`
            : "המרחב שלכם מוכן. מתחילים בצעד קטן."}
        </Text>
        <Button title="למשימות שלנו" onPress={() => router.push("/tasks")} />
      </Card>
      {!finance.loading && !finance.error && (
        <Card>
          <Text style={styles.heading}>הכסף שלנו בתמונה אחת</Text>
          <Text style={styles.text}>
            התחייבנו: {money(budget.committed)} · שולם: {money(budget.paid)}
          </Text>
          <Text style={styles.muted}>
            נותר לתשלום: {money(budget.remaining)}
          </Text>
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
