import { useState } from "react";
import { Text } from "react-native";
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
import { useAuth } from "../providers/AuthProvider";
import { parseBudget, parseDate } from "../core/domain";
export default function Setup() {
  const { createWedding, joinWedding } = useWedding();
  const { isDemo } = useAuth();
  const action = useAction();
  const [one, setOne] = useState("");
  const [two, setTwo] = useState("");
  const [date, setDate] = useState("");
  const [budget, setBudget] = useState("");
  const [joining, setJoining] = useState(false);
  const [token, setToken] = useState("");
  return (
    <Screen>
      <Title>החתונה שלכם, בדרך שלכם</Title>
      <Text style={styles.text}>
        נתחיל בכמה פרטים. אפשר להתחיל גם בלי תאריך ובלי תקציב סופי.
      </Text>
      {isDemo && (
        <Notice text="מצב פיתוח · מחוברים אוטומטית · הנתונים נשמרים במכשיר הזה בלבד" />
      )}
      <Card>
        {joining ? (
          <>
            <Field
              label="קוד הזמנה מבן או בת הזוג"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
            />
            <Button
              title="הצטרפות לחתונה"
              busy={action.busy}
              onPress={() => {
                void action.run(() => joinWedding(token));
              }}
            />
          </>
        ) : (
          <>
            <Field
              label="השם שלך — רשות"
              value={one}
              onChangeText={setOne}
              maxLength={60}
              placeholder="הזינו שם"
            />
            <Field
              label="שם בן או בת הזוג — רשות"
              value={two}
              onChangeText={setTwo}
              maxLength={60}
              placeholder="הזינו שם"
            />
            <Field
              label="תאריך חתונה — רשות"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              maxLength={10}
            />
            <Field
              label="תקציב יעד בשקלים — רשות"
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
              placeholder="טרם החלטנו"
            />
            <Button
              title="למרחב שלנו"
              busy={action.busy}
              onPress={() => {
                void action.run(() =>
                  createWedding({
                    partner_one: one.trim(),
                    partner_two: two.trim(),
                    wedding_date: parseDate(date),
                    budget: parseBudget(budget),
                  }),
                );
              }}
            />
          </>
        )}
        <Notice text={action.message} error />
      </Card>
      <Button
        title={
          joining ? "יצירת חתונה חדשה" : "יש לכם קוד? הצטרפות לחתונה קיימת"
        }
        secondary
        disabled={action.busy}
        onPress={() => setJoining(!joining)}
      />
    </Screen>
  );
}
