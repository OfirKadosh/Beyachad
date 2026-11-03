import { useRef, useState, type PropsWithChildren } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
export const colors = {
  bg: "#F7F6F0",
  paper: "#FFFFFF",
  ink: "#293B32",
  muted: "#667368",
  green: "#365947",
  sage: "#E6EBDF",
  border: "#DFE3D8",
  danger: "#A13636",
};
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    padding: 24,
    gap: 16,
    paddingBottom: 36,
  },
  title: {
    fontSize: 30,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "right",
    writingDirection: "rtl",
  },
  heading: {
    fontSize: 19,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "right",
    writingDirection: "rtl",
  },
  text: {
    fontSize: 16,
    lineHeight: 25,
    color: colors.ink,
    textAlign: "right",
    writingDirection: "rtl",
  },
  muted: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    textAlign: "right",
    writingDirection: "rtl",
  },
  card: {
    padding: 20,
    gap: 12,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
  },
  hero: { backgroundColor: colors.sage, borderWidth: 0 },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  button: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 13,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.green,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    color: "#FFFFFF",
  },
  secondary: { backgroundColor: colors.sage },
  input: {
    minHeight: 50,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.paper,
    fontSize: 16,
    textAlign: "right",
    color: colors.ink,
  },
  error: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.danger,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.row}>
            <Text style={[styles.heading, { fontSize: 24 }]}>ביחד.</Text>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Title({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}
export function Card({
  children,
  hero = false,
}: PropsWithChildren<{ hero?: boolean }>) {
  return <View style={[styles.card, hero && styles.hero]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
}: {
  title: string;
  onPress(): void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        { opacity: disabled || busy ? 0.55 : pressed ? 0.8 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.ink : "#FFFFFF"} />
      ) : (
        <Text style={[styles.buttonText, secondary && { color: colors.ink }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.text}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return text ? (
    <Text
      accessibilityLiveRegion="polite"
      style={error ? styles.error : styles.muted}
    >
      {text}
    </Text>
  ) : null;
}
export function Loading() {
  return (
    <Screen>
      <Title>עוד רגע, אנחנו מסדרים הכול</Title>
      <ActivityIndicator size="large" color={colors.green} />
    </Screen>
  );
}
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  async function run(action: () => Promise<void>, success = "") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "משהו השתבש. נסו שוב.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return { busy, message, run };
}
