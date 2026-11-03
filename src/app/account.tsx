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
import { useAuth } from "../providers/AuthProvider";
import { useWedding } from "../providers/WeddingProvider";
import { requireBackend } from "../services/backend";
export default function Account() {
  const auth = useAuth(),
    { wedding, leaveWedding } = useWedding(),
    action = useAction();
  const [mode, setMode] = useState<"leave" | "delete" | null>(null),
    [confirmation, setConfirmation] = useState(""),
    [password, setPassword] = useState("");
  return (
    <Screen>
      <Button
        title={wedding ? "חזרה להגדרות" : "חזרה להגדרה הראשונית"}
        secondary
        disabled={action.busy}
        onPress={() => router.dismissTo(wedding ? "/settings" : "/setup")}
      />
      <Title>החשבון והמרחב שלכם</Title>
      <Card>
        <Text style={styles.heading}>עוזבים מרחב משותף?</Text>
        <Text style={styles.text}>
          אם בן או בת הזוג נשארים, הנתונים המשותפים נשארים אצלם והם מקבלים בעלות
          על המרחב. ההקצאות לפי הצדדים נשמרות. הזמנה עתידית תחליף את הצד שעזב.
        </Text>
        <Text style={styles.muted}>
          אם אתם האחרונים במרחב, הנתונים יימחקו. יש למחוק קודם את כל המסמכים. לא
          ניתן לבטל עזיבה או מחיקה.
        </Text>
        <Button
          title="עזיבת מרחב החתונה"
          secondary
          disabled={auth.isDemo || action.busy || !wedding}
          onPress={() => {
            setMode("leave");
            setConfirmation("");
            setPassword("");
          }}
        />
      </Card>
      <Card>
        <Text style={styles.heading}>מחיקת החשבון לצמיתות</Text>
        <Text style={styles.text}>
          המחיקה מסירה את חשבון הכניסה שלכם ואת הגישה למרחב. מידע משותף נשאר לבן
          או בת זוג שעדיין חברים בו; מרחב ללא חברים נמחק.
        </Text>
        <Button
          title="מחיקת החשבון שלי"
          secondary
          disabled={auth.isDemo || action.busy}
          onPress={() => {
            setMode("delete");
            setConfirmation("");
            setPassword("");
          }}
        />
      </Card>
      {auth.isDemo && (
        <Notice text="עזיבה ומחיקת חשבון דורשות חשבון אמיתי. נתוני הפיתוח ניתנים לאיפוס בהגדרות." />
      )}
      {mode && (
        <Card>
          <Text style={styles.heading}>
            {mode === "delete" ? "אישור מחיקת חשבון" : "אישור עזיבת המרחב"}
          </Text>
          <Field
            label={
              mode === "delete" ? "להמשך, הקלידו מחיקה" : "להמשך, הקלידו עזיבה"
            }
            value={confirmation}
            onChangeText={setConfirmation}
          />
          {mode === "delete" && (
            <Field
              label="הסיסמה הנוכחית"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
            />
          )}
          <Button
            title={
              mode === "delete"
                ? "אישור מחיקת החשבון לצמיתות"
                : "אישור עזיבת המרחב"
            }
            busy={action.busy}
            disabled={confirmation !== (mode === "delete" ? "מחיקה" : "עזיבה")}
            onPress={() => {
              void action.run(async () => {
                if (mode === "leave") {
                  await leaveWedding();
                  return;
                }
                const db = requireBackend();
                const {
                  data: { user },
                  error: userError,
                } = await db.auth.getUser();
                if (userError || !user?.email || !password)
                  throw Error("יש להזין את הסיסמה הנוכחית.");
                const { data, error: loginError } =
                  await db.auth.signInWithPassword({
                    email: user.email,
                    password,
                  });
                if (loginError || data.user?.id !== user.id)
                  throw Error("הסיסמה לא אומתה.");
                setPassword("");
                const { error } = await db.rpc("delete_my_account");
                if (error)
                  throw Error(
                    "המחיקה לא הושלמה. אם אתם האחרונים במרחב, מחקו קודם את המסמכים. אחרת בדקו חיבור ונסו שוב.",
                  );
                await auth.signOut();
              });
            }}
          />
          <Button
            title="ביטול הפעולה"
            secondary
            disabled={action.busy}
            onPress={() => {
              setMode(null);
              setPassword("");
              setConfirmation("");
            }}
          />
          <Notice text={action.message} error />
        </Card>
      )}
    </Screen>
  );
}
