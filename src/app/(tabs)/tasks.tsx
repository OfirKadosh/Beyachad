import { useState } from "react";
import { Pressable, Text, View } from "react-native";
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
import { useWedding } from "../../providers/WeddingProvider";
export default function Tasks() {
  const { tasks, addTask, toggleTask } = useWedding();
  const action = useAction();
  const [title, setTitle] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const shown = tasks.filter((t) => !openOnly || !t.completed);
  return (
    <Screen>
      <Title>המשימות שלנו</Title>
      <Text style={styles.muted}>
        כל צעד קטן מקדם אתכם. המשימות בשלב הזה משותפות לשניכם.
      </Text>
      <Card>
        <Field
          label="משימה חדשה"
          value={title}
          onChangeText={setTitle}
          placeholder="מה צריך לעשות?"
          maxLength={160}
        />
        <Button
          title="הוספת משימה"
          busy={action.busy}
          onPress={() => {
            void action.run(async () => {
              await addTask(title);
              setTitle("");
            });
          }}
        />
      </Card>
      <Button
        title={openOnly ? "הצגת כל המשימות" : "הצגת משימות פתוחות בלבד"}
        secondary
        onPress={() => setOpenOnly(!openOnly)}
      />
      <Notice text={action.message} error />
      {!shown.length && (
        <Card>
          <Text style={styles.heading}>אין כאן משימות כרגע</Text>
          <Text style={styles.muted}>
            אפשר להוסיף משימה או לבחור המלצות במסך הבית.
          </Text>
        </Card>
      )}
      {shown.map((task) => (
        <Pressable
          key={task.id}
          accessibilityRole="checkbox"
          aria-checked={task.completed}
          accessibilityLabel={task.title}
          accessibilityState={{
            checked: task.completed,
            disabled: action.busy,
          }}
          disabled={action.busy}
          onPress={() => {
            void action.run(() => toggleTask(task));
          }}
          style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.row}>
            <Text style={{ color: colors.green, fontSize: 25 }}>
              {task.completed ? "☑" : "☐"}
            </Text>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.text,
                  task.completed && {
                    textDecorationLine: "line-through",
                    color: colors.muted,
                  },
                ]}
              >
                {task.title}
              </Text>
              <Text style={styles.muted}>
                {task.completed ? "הושלם" : "לביצוע"} · שנינו
              </Text>
            </View>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
