import { router } from "expo-router";
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
import { useAuth } from "../providers/AuthProvider";
import { requireBackend } from "../services/backend";
import { backendConfigured } from "../services/config";
export default function AuthScreen() {
  const auth = useAuth();
  const action = useAction();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  async function submit() {
    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized))
      throw Error("יש להזין כתובת אימייל תקינה.");
    if (!password || (mode === "register" && password.length < 10))
      throw Error("בהרשמה יש לבחור סיסמה באורך 10 תווים לפחות.");
    if (mode === "register" && password !== confirmation)
      throw Error("הסיסמאות אינן תואמות.");
    const db = requireBackend();
    const result =
      mode === "login"
        ? await db.auth.signInWithPassword({ email: normalized, password })
        : await db.auth.signUp({ email: normalized, password });
    if (result.error)
      throw Error(
        mode === "login"
          ? "הכניסה נכשלה. בדקו את הפרטים ואימות האימייל ונסו שוב."
          : "ההרשמה לא הושלמה. בדקו את הפרטים או נסו להתחבר.",
      );
    setPassword("");
    setConfirmation("");
    if (mode === "register" && !result.data.session)
      throw Error(
        "אם הכתובת זמינה להרשמה, יישלח אליה קישור אימות. לאחר האימות חזרו לכאן והתחברו.",
      );
  }
  if (auth.recovering)
    return (
      <Screen>
        <Title>מעדכנים את הסיסמה</Title>
        <Button
          title="להשלמת שחזור הסיסמה"
          onPress={() => router.replace("/recovery")}
        />
      </Screen>
    );
  if (auth.locked)
    return (
      <Screen>
        <Title>טוב שחזרתם</Title>
        <Text style={styles.text}>
          פתחו את האפליקציה באמצעות הזיהוי הביומטרי במכשיר.
        </Text>
        <Button
          title="פתיחה עם זיהוי ביומטרי"
          busy={action.busy}
          onPress={() => {
            void action.run(auth.unlock);
          }}
        />
        <Button
          title="יציאה וכניסה מחדש עם סיסמה"
          secondary
          disabled={action.busy}
          onPress={() => {
            void action.run(auth.signOut);
          }}
        />
        <Notice text={action.message || auth.error} error />
      </Screen>
    );
  return (
    <Screen>
      <Title>
        {mode === "login" ? "היום שלכם מתחיל כאן" : "מתחילים לתכנן ביחד"}
      </Title>
      <Text style={styles.muted}>
        מרחב פרטי לחתונה שלכם. לכל אחד חשבון משלו, ולשניכם תוכנית משותפת.
      </Text>
      <Card>
        <Field
          label="אימייל"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Field
          label="סיסמה"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          textContentType={mode === "login" ? "password" : "newPassword"}
        />
        {mode === "register" && (
          <Field
            label="אימות סיסמה"
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
          />
        )}
        <Button
          title={mode === "login" ? "כניסה" : "יצירת חשבון"}
          busy={action.busy}
          disabled={!backendConfigured}
          onPress={() => {
            void action.run(submit);
          }}
        />
        <Notice text={action.message || auth.error} error />
      </Card>
      <Button
        title={mode === "login" ? "חדשים כאן? הרשמה" : "כבר יש חשבון? כניסה"}
        secondary
        disabled={action.busy}
        onPress={() => {
          setMode(mode === "login" ? "register" : "login");
          setPassword("");
          setConfirmation("");
        }}
      />
      <Button
        title="שכחתם סיסמה?"
        secondary
        disabled={action.busy}
        onPress={() => router.push("/recovery")}
      />
      <Button
        title="פרטיות ועזרה"
        secondary
        onPress={() => router.push("/privacy")}
      />
      {!backendConfigured && (
        <Notice text="מסכי החשבונות מוכנים. להפעלתם יש לחבר את שירות החשבונות לפי README; אין התחברות מדומה בפרודקשן." />
      )}
      <Text style={styles.muted}>
        אפשר להפעיל Face ID או Touch ID בהגדרות, לאחר התחברות ראשונה במכשיר
        תומך.
      </Text>
    </Screen>
  );
}
