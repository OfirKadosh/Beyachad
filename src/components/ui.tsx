import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  Animated,
  Easing,
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
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useReducedMotion } from "./motion";
import { SafeAreaView } from "react-native-safe-area-context";
export const colors = {
  bg: "#F8F7FC",
  paper: "#FFFFFF",
  ink: "#202E3D",
  muted: "#5C687A",
  green: "#087F79",
  sage: "#DEF3ED",
  border: "#E3E5EF",
  danger: "#B52D48",
  purple: "#7050B5",
  lavender: "#EEE7FB",
  peach: "#FFF0DF",
  coral: "#CF6741",
};
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    padding: 22,
    gap: 16,
    paddingBottom: 36,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "right",
    writingDirection: "rtl",
  },
  heading: {
    fontSize: 19,
    fontWeight: "700",
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
    borderRadius: 24,
    boxShadow: "0px 5px 18px rgba(43, 35, 79, 0.045)",
  },
  hero: { backgroundColor: colors.sage, borderColor: "#B7E0D5" },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  button: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 13,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.green,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    color: "#FFFFFF",
  },
  secondary: { backgroundColor: colors.sage },
  input: {
    minHeight: 50,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
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
  const reduced = useReducedMotion();
  const [entry] = useState(() => new Animated.Value(1));
  useFocusEffect(
    useCallback(() => {
      entry.setValue(reduced ? 1 : 0);
      const animation = Animated.timing(entry, {
        toValue: 1,
        duration: 330,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
        isInteraction: false,
      });
      if (!reduced) animation.start();
      return () => animation.stop();
    }, [entry, reduced]),
  );
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
          <View
            style={[
              styles.row,
              { justifyContent: "space-between", marginBottom: 4 },
            ]}
          >
            <View style={styles.row}>
              <LinearGradient
                colors={["#087F79", "#7050B5"]}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="heart" size={20} color="white" />
              </LinearGradient>
              <Text
                style={[styles.heading, { fontSize: 25, letterSpacing: -1 }]}
              >
                ביחד.
              </Text>
            </View>
            <Text style={[styles.muted, { fontSize: 12 }]}>הדרך ליום שלכם</Text>
          </View>
          <Animated.View
            style={{
              gap: 16,
              opacity: entry,
              transform: [
                {
                  translateY: entry.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            }}
          >
            {children}
          </Animated.View>
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
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  function press(toValue: number) {
    Animated.spring(scale, {
      toValue: reduced ? 1 : toValue,
      speed: 35,
      bounciness: 3,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={() => press(0.975)}
        onPressOut={() => press(1)}
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
    </Animated.View>
  );
}
export function Field({
  label,
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.text}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          focused && { borderColor: colors.green, backgroundColor: "#F5FCFA" },
          style,
        ]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
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
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  async function run(action: () => Promise<void>, success = "") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setFailed(true);
      setMessage(e instanceof Error ? e.message : "משהו השתבש. נסו שוב.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return { busy, message, failed, run };
}

export function Progress({
  value,
  label,
  color = colors.green,
}: {
  value: number;
  label: string;
  color?: string;
}) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: clamped,
      duration: reduced ? 0 : 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [clamped, progress, reduced]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height: 8,
        borderRadius: 8,
        backgroundColor: colors.border,
        overflow: "hidden",
        flexDirection: "row-reverse",
      }}
    >
      <Animated.View
        style={{
          height: 8,
          borderRadius: 8,
          backgroundColor: color,
          width: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ["0%", "100%"],
          }),
        }}
      />
    </View>
  );
}
