import { DateField } from "../components/DateField";
import { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
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
import { useWedding } from "../providers/WeddingProvider";
export default function WeddingDetails() {
  const { wedding, saveDetails } = useWedding();
  const [original] = useState(wedding);
  const [one, setOne] = useState(original?.partner_one ?? "");
  const [two, setTwo] = useState(original?.partner_two ?? "");
  const [date, setDate] = useState(original?.wedding_date ?? "");
  const action = useAction();
  return (
    <Screen>
      <Button
        title="חזרה לבית ללא שמירה"
        secondary
        disabled={action.busy}
        onPress={() => router.dismissTo("/")}
      />
      <Title>הפרטים שהופכים את זה לשלכם</Title>
      <Text style={styles.muted}>
        אפשר להשאיר שמות ותאריך ריקים ולחזור לעדכן מתי שתרצו. השינוי משותף
        לשניכם.
      </Text>
      <Card>
        <Field
          label="השם הראשון — רשות"
          value={one}
          onChangeText={setOne}
          maxLength={60}
        />
        <Field
          label="השם השני — רשות"
          value={two}
          onChangeText={setTwo}
          maxLength={60}
        />
        <DateField
          label="תאריך החתונה — רשות"
          value={date}
          onChange={setDate}
          disabled={action.busy}
          optional
        />
        <Button
          title="שמירת פרטי החתונה"
          busy={action.busy}
          onPress={() => {
            void action.run(async () => {
              if (!original) throw Error("יש להגדיר מרחב תחילה.");
              await saveDetails(original, {
                partner_one: one,
                partner_two: two,
                wedding_date: date || null,
              });
              router.dismissTo("/");
            });
          }}
        />
        <Notice text={action.message} error />
      </Card>
    </Screen>
  );
}
