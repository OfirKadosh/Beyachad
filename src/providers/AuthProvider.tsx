import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import type { Session } from "@supabase/supabase-js";
import { backend, requireBackend } from "../services/backend";
import { devSession } from "../services/config";

type Auth = {
  userId: string | null;
  ready: boolean;
  locked: boolean;
  biometric: boolean;
  isDemo: boolean;
  error: string;
  signOut(): Promise<void>;
  unlock(): Promise<void>;
  setBiometric(enabled: boolean): Promise<void>;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(devSession || !backend);
  const [locked, setLocked] = useState(false);
  const [biometric, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const enabled = useRef(false);
  const prompting = useRef(false);
  const user = useRef<string | null>(null);
  const userId = devSession ? "development-user" : (session?.user.id ?? null);
  useEffect(() => {
    if (devSession || !backend) return;
    let alive = true;
    let revision = 0;
    async function apply(next: Session | null) {
      const current = ++revision;
      const id = next?.user.id ?? null;
      // Never hide an existing lock when a token-refresh event arrives.
      if (id === user.current) {
        if (alive) {
          setSession(next);
          setReady(true);
        }
        return;
      }
      try {
        const on =
          id && Platform.OS !== "web"
            ? (await SecureStore.getItemAsync(`biometric.${id}`)) === "true"
            : false;
        if (!alive || current !== revision) return;
        user.current = id;
        enabled.current = on;
        setEnabled(on);
        setLocked(!!id && on);
        setSession(next);
        setReady(true);
      } catch {
        if (alive) {
          setLocked(true);
          setError(
            "לא ניתן לקרוא את הגדרות האבטחה. אפשר לנסות שוב או להתחבר מחדש.",
          );
          setSession(next);
          setReady(true);
        }
      }
    }
    const subscription = backend.auth.onAuthStateChange((_event, next) => {
      void apply(next);
    });
    backend.auth
      .getSession()
      .then(({ data, error: e }) => {
        if (e) throw e;
        return apply(data.session);
      })
      .catch(() => {
        if (alive) {
          setError("לא ניתן לשחזר את ההתחברות. יש להתחבר מחדש.");
          setReady(true);
        }
      });
    const state = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        backend?.auth.stopAutoRefresh();
        if (enabled.current && !prompting.current) setLocked(true);
      }
      if (next === "active") backend?.auth.startAutoRefresh();
    });
    backend.auth.startAutoRefresh();
    return () => {
      alive = false;
      subscription.data.subscription.unsubscribe();
      state.remove();
      backend?.auth.stopAutoRefresh();
    };
  }, []);
  async function signOut() {
    if (devSession)
      throw Error(
        "במצב הפיתוח נשארים מחוברים. לבדיקת מסכי הכניסה יש להגדיר EXPO_PUBLIC_DEV_SESSION=false ולהפעיל מחדש.",
      );
    const { error: e } = await requireBackend().auth.signOut({
      scope: "local",
    });
    if (e) throw e;
    if (userId && Platform.OS !== "web")
      await SecureStore.deleteItemAsync(`biometric.${userId}`);
    setSession(null);
    setLocked(false);
    setEnabled(false);
    enabled.current = false;
    user.current = null;
  }
  async function authenticate() {
    if (Platform.OS === "web")
      throw Error("זיהוי ביומטרי זמין באפליקציה במכשיר תומך.");
    if (
      !(await LocalAuthentication.hasHardwareAsync()) ||
      !(await LocalAuthentication.isEnrolledAsync())
    )
      throw Error(
        "לא נמצא זיהוי ביומטרי פעיל במכשיר. אפשר להפעיל אותו בהגדרות המכשיר.",
      );
    prompting.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "פתיחת ביחד",
        cancelLabel: "ביטול",
        disableDeviceFallback: true,
        biometricsSecurityLevel: "strong",
      });
      if (!result.success)
        throw Error("הזיהוי לא הושלם. אפשר לנסות שוב או להתחבר באמצעות סיסמה.");
    } finally {
      prompting.current = false;
    }
  }
  async function unlock() {
    await authenticate();
    setLocked(false);
    setError("");
  }
  async function setBiometric(on: boolean) {
    if (devSession || !userId)
      throw Error("יש להתחבר לחשבון אמיתי לפני הפעלת זיהוי ביומטרי.");
    await authenticate();
    await SecureStore.setItemAsync(`biometric.${userId}`, String(on));
    enabled.current = on;
    setEnabled(on);
  }
  return (
    <Context.Provider
      value={{
        userId,
        ready,
        locked,
        biometric,
        isDemo: devSession,
        error,
        signOut,
        unlock,
        setBiometric,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw Error("AuthProvider missing");
  return value;
}
