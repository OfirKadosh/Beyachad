import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  colors,
  Field,
  Notice,
  Screen,
  styles,
  Title,
  useAction,
} from "../../components/ui";
import { Choice } from "../../components/Choice";
import {
  assigneeLabel,
  categoryLabels,
  formatDueDate,
  isOverdue,
  priorityLabels,
  selectTasks,
  statusLabels,
  type TaskFilter,
  type TaskSort,
} from "../../core/tasks";
import { type Task } from "../../core/domain";
import { useWedding } from "../../providers/WeddingProvider";
export default function Tasks() {
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  return (
    <TaskList key={saved ?? "initial"} initialFilter={saved ? "all" : "open"} />
  );
}
function TaskList({ initialFilter }: { initialFilter: TaskFilter }) {
  const { tasks, wedding, viewerSlot, toggleTask } = useWedding();
  const action = useAction();
  const [filter, setFilter] = useState<TaskFilter>(initialFilter);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TaskSort>("due");
  const [category, setCategory] = useState<Task["category"] | "all">("all");
  const [advanced, setAdvanced] = useState(false);
  const shown = selectTasks(tasks, {
    filter,
    query,
    sort,
    viewer: viewerSlot,
    category,
  });
  const done = tasks.filter((t) => t.status === "done").length;
  return (
    <Screen>
      <Title>המשימות שלנו</Title>
      <Text style={styles.muted}>
        {tasks.length
          ? `${done} מתוך ${tasks.length} משימות הושלמו`
          : "כל צעד קטן מקדם אתכם. בוחרים משימה ומחלקים אחריות."}
      </Text>
      <Button title="משימה חדשה" onPress={() => router.push("/task-editor")} />
      <Field
        label="חיפוש במשימות"
        value={query}
        onChangeText={setQuery}
        placeholder="חיפוש בשם או בהערות"
      />
      <Choice<TaskFilter>
        label="הצגת משימות"
        value={filter}
        options={[
          { value: "open", label: "פתוחות" },
          { value: "mine", label: "שלי" },
          { value: "all", label: "הכול" },
          { value: "done", label: "הושלמו" },
        ]}
        onChange={setFilter}
      />
      <Button
        title={advanced ? "סגירת אפשרויות הסינון" : "סינון לפי קטגוריה ומיון"}
        secondary
        onPress={() => setAdvanced(!advanced)}
      />
      {advanced && (
        <Card>
          <Choice<Task["category"] | "all">
            label="קטגוריה לסינון"
            value={category}
            options={[
              { value: "all", label: "הכול" },
              ...Object.entries(categoryLabels).map(([value, label]) => ({
                value: value as Task["category"],
                label,
              })),
            ]}
            onChange={setCategory}
          />
          <Choice<TaskSort>
            label="מיון"
            value={sort}
            options={[
              { value: "due", label: "תאריך יעד" },
              { value: "priority", label: "עדיפות" },
            ]}
            onChange={setSort}
          />
        </Card>
      )}
      <Notice text={action.message} error />
      {!shown.length && (
        <Card>
          <Text style={styles.heading}>
            {tasks.length ? "לא נמצאו משימות בתצוגה הזו" : "מתחילים עם דף נקי"}
          </Text>
          <Text style={styles.muted}>
            {tasks.length
              ? "אפשר לשנות את החיפוש או הסינון."
              : "מוסיפים משימה חדשה או בוחרים המלצות במסך הבית."}
          </Text>
        </Card>
      )}
      {shown.map((task) => (
        <Card key={task.id}>
          <View
            style={[
              styles.row,
              { flexWrap: "nowrap", alignItems: "flex-start" },
            ]}
          >
            <Pressable
              accessibilityRole="checkbox"
              aria-checked={task.completed}
              accessibilityLabel={`השלמת משימה: ${task.title}`}
              accessibilityState={{
                checked: task.completed,
                disabled: action.busy,
              }}
              disabled={action.busy}
              onPress={() => {
                void action.run(() => toggleTask(task));
              }}
              style={{
                minHeight: 44,
                minWidth: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.green, fontSize: 27 }}>
                {task.completed ? "☑" : "☐"}
              </Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.heading,
                  task.completed && {
                    textDecorationLine: "line-through",
                    color: colors.muted,
                  },
                ]}
              >
                {task.title}
              </Text>
              <Text style={styles.muted}>
                {statusLabels[task.status]} ·{" "}
                {assigneeLabel(task.owner, wedding, viewerSlot)}
              </Text>
            </View>
          </View>
          <Text style={styles.muted}>
            {categoryLabels[task.category]} · עדיפות{" "}
            {priorityLabels[task.priority]}
          </Text>
          <Text style={isOverdue(task) ? styles.error : styles.muted}>
            {isOverdue(task) ? "באיחור · " : ""}
            {formatDueDate(task.due_date)}
          </Text>
          {!!task.notes && (
            <Text numberOfLines={2} style={styles.muted}>
              {task.notes}
            </Text>
          )}
          <Button
            title={`עריכה: ${task.title}`}
            secondary
            disabled={action.busy}
            onPress={() =>
              router.push({ pathname: "/task-editor", params: { id: task.id } })
            }
          />
        </Card>
      ))}
    </Screen>
  );
}
