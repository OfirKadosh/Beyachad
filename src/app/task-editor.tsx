import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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
import { type Task } from "../core/domain";
import {
  assigneeLabel,
  categoryLabels,
  emptyTask,
  priorityLabels,
  statusLabels,
  type TaskDraft,
} from "../core/tasks";
import { useWedding } from "../providers/WeddingProvider";

export default function TaskEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <Editor key={id ?? "new"} id={id} />;
}
function Editor({ id }: { id?: string }) {
  const store = useWedding();
  const action = useAction();
  // Keep the opened version as the edit baseline. Realtime must not overwrite a draft.
  const [original] = useState<Task | undefined>(() =>
    store.tasks.find((t) => t.id === id),
  );
  const [draft, setDraft] = useState<TaskDraft>(() =>
    original ? { ...original } : emptyTask(),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const current = store.tasks.find((t) => t.id === id);
  const changed = !!original && current?.version !== original.version;
  function update<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function exit() {
    router.dismissTo("/tasks");
  }
  function savedExit() {
    // Show the saved task even when the previous list had an excluding filter.
    router.dismissTo({
      pathname: "/tasks",
      params: { saved: String(Date.now()) },
    });
  }
  if (id && !original)
    return (
      <Screen>
        <Title>המשימה אינה ברשימה</Title>
        <Text style={styles.text}>ייתכן שהיא נמחקה ממכשיר אחר.</Text>
        <Button title="חזרה למשימות" onPress={exit} />
      </Screen>
    );
  return (
    <Screen>
      <Button
        title="חזרה למשימות ללא שמירה"
        secondary
        disabled={action.busy}
        onPress={exit}
      />
      <Title>{original ? "עורכים משימה" : "צעד חדש בדרך לחתונה"}</Title>
      {changed && (
        <Notice
          text="המשימה השתנתה או נמחקה מאז שפתחתם אותה. הטיוטה נשמרת כאן; חזרו לרשימה ופתחו מחדש כדי לעבוד על הגרסה העדכנית."
          error
        />
      )}
      <Card>
        <Field
          label="שם המשימה"
          value={draft.title}
          onChangeText={(v) => update("title", v)}
          placeholder="מה צריך לעשות?"
          maxLength={160}
          editable={!action.busy}
        />
        <Choice
          label="אחריות"
          value={draft.owner}
          options={(
            [
              "both",
              store.viewerSlot,
              store.viewerSlot === "one" ? "two" : "one",
            ] as const
          ).map((value) => ({
            value,
            label: assigneeLabel(value, store.wedding, store.viewerSlot),
          }))}
          onChange={(v) => update("owner", v)}
          disabled={action.busy}
        />
        <Choice
          label="מצב ביצוע"
          value={draft.status}
          options={Object.entries(statusLabels).map(([value, label]) => ({
            value: value as Task["status"],
            label,
          }))}
          onChange={(v) => update("status", v)}
          disabled={action.busy}
        />
        <Choice
          label="עדיפות"
          value={draft.priority}
          options={Object.entries(priorityLabels).map(([value, label]) => ({
            value: value as Task["priority"],
            label,
          }))}
          onChange={(v) => update("priority", v)}
          disabled={action.busy}
        />
        <Choice
          label="קטגוריה"
          value={draft.category}
          options={Object.entries(categoryLabels).map(([value, label]) => ({
            value: value as Task["category"],
            label,
          }))}
          onChange={(v) => update("category", v)}
          disabled={action.busy}
        />
        <Field
          label="תאריך יעד — רשות"
          value={draft.due_date ?? ""}
          placeholder="YYYY-MM-DD"
          maxLength={10}
          autoCapitalize="none"
          onChangeText={(v) => update("due_date", v || null)}
          editable={!action.busy}
        />
        <Field
          label="הערות — רשות"
          value={draft.notes}
          multiline
          numberOfLines={4}
          maxLength={2000}
          onChangeText={(v) => update("notes", v)}
          editable={!action.busy}
        />
        <Button
          title={original ? "שמירת שינויים" : "יצירת משימה"}
          disabled={changed}
          busy={action.busy}
          onPress={() => {
            void action.run(async () => {
              if (original) await store.updateTask(original, draft);
              else await store.createTask(draft);
              savedExit();
            });
          }}
        />
        <Notice text={action.message} error />
      </Card>
      {original && (
        <Card>
          <Text style={styles.heading}>מחיקת המשימה</Text>
          {confirmDelete ? (
            <>
              <Text style={styles.text}>
                למחוק את ״{original.title}״? המשימה תוסר מהרשימה המשותפת.
              </Text>
              <Button
                title="אישור מחיקת המשימה"
                disabled={changed}
                busy={action.busy}
                onPress={() => {
                  void action.run(async () => {
                    await store.deleteTask(original);
                    savedExit();
                  });
                }}
              />
              <Button
                title="ביטול המחיקה"
                secondary
                disabled={action.busy}
                onPress={() => setConfirmDelete(false)}
              />
            </>
          ) : (
            <Button
              title="מחיקת משימה"
              secondary
              disabled={action.busy || changed}
              onPress={() => setConfirmDelete(true)}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}
