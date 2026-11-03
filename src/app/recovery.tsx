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
import { backendConfigured } from "../services/config";
import { requireBackend } from "../services/backend";
import {
  normalizedEmail,
  validateNewPassword,
  validateRecoveryCode,
} from "../core/account";
export default function Recovery() {
  const auth = useAuth(),
    action = useAction();
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [sent, setSent] = useState(false);
  return (
    <Screen>
      <Title>חוזרים למרחב שלכם</Title>
      <Text style={styles.muted}>
        נשלח קוד אימות לכתובת החשבון. הזינו אותו כאן ובחרו סיסמה חדשה.
      </Text>
      <Card>
        {auth.recovering && auth.userId ? (
          <>
            <Field
              label="סיסמה חדשה"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            <Field
              label="אימות הסיסמה החדשה"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
            />
            <Button
              title="שמירת הסיסמה החדשה"
              busy={action.busy}
              onPress={() => {
                void action.run(async () => {
                  validateNewPassword(password, confirm);
                  const { error } = await requireBackend().auth.updateUser({
                    password,
                  });
                  if (error)
                    throw Error(
                      "עדכון הסיסמה נכשל. ייתכן שפג תוקף האימות; נסו לבקש קוד חדש.",
                    );
                  setPassword("");
                  setConfirm("");
                  await auth.signOut();
                  router.replace("/auth");
                });
              }}
            />
          </>
        ) : (
          <>
            <Field
              label="אימייל לשחזור"
              value={email}
              editable={!action.busy}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Button
              title={sent ? "שליחת קוד נוסף" : "שליחת קוד שחזור"}
              disabled={!backendConfigured}
              busy={action.busy}
              onPress={() => {
                void action.run(async () => {
                  const address = normalizedEmail(email);
                  const { error } =
                    await requireBackend().auth.resetPasswordForEmail(address);
                  if (error)
                    throw Error("לא ניתן לשלוח כעת. המתינו מעט ונסו שוב.");
                  setSent(true);
                }, "אם קיים חשבון לכתובת הזו, יישלח אליה קוד שחזור.");
              }}
            />
            {sent && (
              <>
                <Field
                  label="קוד שחזור מהאימייל"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                />
                <Button
                  title="אימות קוד השחזור"
                  busy={action.busy}
                  onPress={() => {
                    void action.run(async () => {
                      const token = validateRecoveryCode(code),
                        address = normalizedEmail(email);
                      auth.beginRecovery();
                      const { error } = await requireBackend().auth.verifyOtp({
                        email: address,
                        token,
                        type: "recovery",
                      });
                      if (error) {
                        auth.finishRecovery();
                        throw Error(
                          "הקוד אינו תקין או שפג תוקפו. נסו שוב או בקשו קוד חדש.",
                        );
                      }
                      setCode("");
                    });
                  }}
                />
              </>
            )}
          </>
        )}
        <Notice text={action.message} error={action.failed} />
      </Card>
      <Button
        title={auth.recovering ? "ביטול השחזור ויציאה" : "חזרה לכניסה"}
        secondary
        disabled={action.busy}
        onPress={() => {
          void action.run(async () => {
            if (auth.recovering) await auth.signOut();
            router.replace("/auth");
          });
        }}
      />
    </Screen>
  );
}
