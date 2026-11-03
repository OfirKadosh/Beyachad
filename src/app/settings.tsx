import { useState } from "react";
import { Platform, Share, Text } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Card,
  Notice,
  Screen,
  styles,
  Title,
  useAction,
} from "../components/ui";
import { useAuth } from "../providers/AuthProvider";
import { useWedding } from "../providers/WeddingProvider";
import { requireBackend } from "../services/backend";
export default function Settings() {
  const auth = useAuth();
  const { wedding, resetDemo } = useWedding();
  const action = useAction();
  const [invite, setInvite] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <Screen>
      <Button title="חזרה לבית" secondary onPress={() => router.replace("/")} />
      <Title>הגדרות המרחב שלנו</Title>
      <Card>
        <Text style={styles.heading}>המרחב, בדיוק שלכם</Text>
        <Button
          title="עריכת פרטי החתונה"
          secondary
          onPress={() => router.push("/wedding-details")}
        />
        <Button
          title="מסמכים וחוזים"
          secondary
          onPress={() => router.push("/documents")}
        />
        <Button
          title="ניהול החשבון והמרחב"
          secondary
          onPress={() => router.push("/account")}
        />
        <Button
          title="פרטיות ועזרה"
          secondary
          onPress={() => router.push("/privacy")}
        />
      </Card>
      <Card>
        <Text style={styles.heading}>גישה מהירה ובטוחה</Text>
        <Text style={styles.text}>
          התחברות נשמרת במכשיר. הזיהוי הביומטרי מוסיף נעילה מקומית בפתיחה ובחזרה
          מרקע.
        </Text>
        <Button
          title={
            auth.biometric ? "ביטול נעילה ביומטרית" : "הפעלת Face ID / Touch ID"
          }
          disabled={action.busy || auth.isDemo || Platform.OS === "web"}
          onPress={() => {
            void action.run(() => auth.setBiometric(!auth.biometric));
          }}
        />
        <Text style={styles.muted}>
          דורש חשבון אמיתי ומכשיר תומך. לבדיקת Face ID נדרשת בניית פיתוח
          ייעודית, מעבר ל־ בתצוגת הדפדפן.
        </Text>
      </Card>
      <Card>
        <Text style={styles.heading}>פגישות ותזכורות</Text>
        <Button
          title="ניהול התזכורות במכשיר"
          secondary
          onPress={() => router.navigate("/reminders")}
        />
      </Card>
      <Card>
        <Text style={styles.heading}>מתכננים בשניים</Text>
        <Text style={styles.muted}>
          מפיקים קוד חד־פעמי, שולחים לבן או בת הזוג, ומזינים אותו לאחר ההרשמה.
          תוקף הקוד שבעה ימים.
        </Text>
        <Button
          title="יצירת קוד הזמנה"
          disabled={auth.isDemo || action.busy}
          onPress={() => {
            void action.run(async () => {
              const { data, error } = await requireBackend().rpc(
                "create_invite",
                { p_wedding_id: wedding?.id },
              );
              if (error)
                throw Error(
                  "לא ניתן ליצור הזמנה. בדקו שאתם בעלי החתונה ושיש מקום לשותף נוסף.",
                );
              setInvite(data);
            });
          }}
        />
        {!!invite && (
          <>
            <Text selectable style={styles.text}>
              {invite}
            </Text>
            <Button
              title="שיתוף קוד"
              secondary
              onPress={() => {
                void action.run(async () => {
                  await Share.share({
                    message: `הזמנה למרחב החתונה שלנו באפליקציית ביחד. לאחר הרשמה בוחרים הצטרפות לחתונה ומזינים את הקוד: ${invite}`,
                  });
                });
              }}
            />
          </>
        )}
      </Card>
      <Notice text={action.message} error />
      {auth.isDemo ? (
        <Card>
          <Text style={styles.heading}>כלי פיתוח</Text>
          <Text style={styles.muted}>
            מחוברים אוטומטית. לא נוצרים טוקנים מדומים ולא נשלחים נתוני הדגמה
            לענן.
          </Text>
          <Button
            title={
              confirmReset
                ? "אישור איפוס הנתונים המקומיים"
                : "איפוס וחזרה להגדרה הראשונית"
            }
            secondary
            disabled={action.busy}
            onPress={() => {
              if (!confirmReset) setConfirmReset(true);
              else void action.run(resetDemo);
            }}
          />
        </Card>
      ) : (
        <Button
          title="יציאה מהחשבון במכשיר הזה"
          secondary
          busy={action.busy}
          onPress={() => {
            void action.run(auth.signOut);
          }}
        />
      )}
    </Screen>
  );
}
