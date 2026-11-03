import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { buildReminders, type ReminderItem } from "../core/reminders";
import { deviceTimeZone } from "../core/meetingTime";
import { deviceReminders } from "../services/deviceReminders";
import { notificationAdapter } from "../services/notificationAdapter";
import { useAuth } from "./AuthProvider";
import { useWedding } from "./WeddingProvider";
import { useFinance } from "./FinanceProvider";
import { useMeetings } from "./MeetingProvider";
type Store = {
  items: ReminderItem[];
  now: number;
  zone: string;
  enabled: boolean;
  supported: boolean;
  count: number;
  status: string;
  error: string;
  setEnabled(on: boolean): Promise<void>;
  refresh(): Promise<void>;
};
const Context = createContext<Store | null>(null);
export function ReminderProvider({ children }: PropsWithChildren) {
  const { userId } = useAuth();
  const {
    wedding,
    tasks,
    viewerSlot,
    loading: taskLoading,
    reload: reloadWedding,
  } = useWedding();
  const {
    payments,
    loading: financeLoading,
    error: financeError,
    reload: reloadFinance,
  } = useFinance();
  const {
    meetings,
    loading: meetingLoading,
    error: meetingError,
    reload: reloadMeetings,
  } = useMeetings();
  const [enabled, setOn] = useState(false),
    [ready, setReady] = useState(false),
    [count, setCount] = useState(0),
    [status, setStatus] = useState("disabled"),
    [syncError, setSyncError] = useState(""),
    [now, setNow] = useState(() => Date.now()),
    [zone, setZone] = useState(deviceTimeZone);
  const prefKey = `beyachad.reminders.enabled.${userId}`;
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(prefKey)
      .then((value) => {
        if (alive) {
          setOn(value === "true");
          setReady(true);
        }
      })
      .catch(() => {
        if (alive) {
          setSyncError("לא ניתן לקרוא את הגדרות ההתראות.");
          setReady(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [prefKey]);
  const refresh = useCallback(async () => {
    setNow(Date.now());
    setZone(deviceTimeZone());
    await Promise.all([reloadWedding(), reloadFinance(), reloadMeetings()]);
  }, [reloadWedding, reloadFinance, reloadMeetings]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      listener.remove();
      clearInterval(timer);
    };
  }, [refresh]);
  const agenda = useMemo(() => {
    try {
      return {
        items: buildReminders(meetings, tasks, payments, viewerSlot, zone),
        error: "",
      };
    } catch {
      return {
        items: [],
        error: "יש מועד שאינו נתמך ברשימת התזכורות. בדקו תאריכים ואזור זמן.",
      };
    }
  }, [meetings, tasks, payments, viewerSlot, zone]);
  const sourceError = meetingError || financeError || agenda.error;
  useEffect(() => {
    if (!ready || taskLoading || meetingLoading || financeLoading) return;
    let alive = true;
    const timer = setTimeout(() => {
      void deviceReminders
        .sync(
          `${userId}@${wedding?.id ?? "none"}`,
          sourceError ? [] : agenda.items,
          enabled && !sourceError,
          now,
        )
        .then((result) => {
          if (alive) {
            setCount(result.count);
            setStatus(result.status);
            setSyncError("");
          }
        })
        .catch(() => {
          if (alive)
            setSyncError(
              "עדכון ההתראות במכשיר נכשל. פתחו את התזכורות ונסו לרענן.",
            );
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [
    ready,
    taskLoading,
    meetingLoading,
    financeLoading,
    enabled,
    userId,
    wedding?.id,
    agenda.items,
    sourceError,
    now,
  ]);
  async function setEnabled(on: boolean) {
    if (!notificationAdapter.supported)
      throw Error(
        "התראות מכשיר זמינות באפליקציה מותקנת. בדפדפן משתמשים ברשימת התזכורות.",
      );
    if (on && !(await notificationAdapter.permission(true)))
      throw Error("לא ניתנה הרשאה להתראות. אפשר לאפשר אותן בהגדרות המכשיר.");
    await AsyncStorage.setItem(prefKey, String(on));
    setOn(on);
    if (!on) {
      await deviceReminders.clear();
      setCount(0);
      setStatus("disabled");
    }
  }
  return (
    <Context.Provider
      value={{
        items: agenda.items,
        now,
        zone,
        enabled,
        supported: notificationAdapter.supported,
        count,
        status,
        error: sourceError || syncError,
        setEnabled,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useReminders() {
  const value = useContext(Context);
  if (!value) throw Error("ReminderProvider missing");
  return value;
}
