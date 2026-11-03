import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type Task, type Wedding, validateTitle } from "../core/domain";
import { backend, requireBackend } from "../services/backend";
import { useAuth } from "./AuthProvider";
type Setup = Omit<Wedding, "id">;
type Store = {
  wedding: Wedding | null;
  tasks: Task[];
  loading: boolean;
  error: string;
  reload(): Promise<void>;
  createWedding(input: Setup): Promise<void>;
  joinWedding(token: string): Promise<void>;
  addTask(title: string, recommendationKey?: string): Promise<void>;
  toggleTask(task: Task): Promise<void>;
  resetDemo(): Promise<void>;
};
const Context = createContext<Store | null>(null);
const DEMO_KEY = "beyachad.development.v1";
export function WeddingProvider({ children }: PropsWithChildren) {
  const { userId, isDemo } = useAuth();
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    try {
      if (isDemo) {
        const raw = await AsyncStorage.getItem(DEMO_KEY);
        if (current !== generation.current) return;
        const data = raw ? JSON.parse(raw) : { wedding: null, tasks: [] };
        setWedding(data.wedding);
        setTasks(data.tasks);
      } else if (userId) {
        const db = requireBackend();
        const { data, error: e } = await db
          .from("weddings")
          .select("id, partner_one, partner_two, wedding_date, budget")
          .maybeSingle();
        if (e) throw e;
        const result = data
          ? await db
              .from("tasks")
              .select("*")
              .eq("wedding_id", data.id)
              .order("created_at")
          : { data: [], error: null };
        if (result.error) throw result.error;
        if (current !== generation.current) return;
        setWedding(data);
        setTasks(result.data ?? []);
      }
      if (current === generation.current) setError("");
    } catch {
      if (current === generation.current)
        setError("טעינת הנתונים נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [isDemo, userId]);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    // reload synchronizes asynchronous storage/API results, not derived render state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    return invalidate;
  }, [reload, invalidate]);
  const weddingId = wedding?.id;
  useEffect(() => {
    if (isDemo || !weddingId || !backend) return;
    const channel = backend
      .channel(`wedding-${weddingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `wedding_id=eq.${weddingId}`,
        },
        () => {
          void reload();
        },
      )
      .subscribe();
    return () => {
      void backend?.removeChannel(channel);
    };
  }, [isDemo, weddingId, reload]);
  // Mutations are serialized in the UI; storage errors propagate before state changes.
  async function saveDemo(nextWedding: Wedding | null, nextTasks: Task[]) {
    await AsyncStorage.setItem(
      DEMO_KEY,
      JSON.stringify({ wedding: nextWedding, tasks: nextTasks }),
    );
    setWedding(nextWedding);
    setTasks(nextTasks);
  }
  async function createWedding(input: Setup) {
    if (isDemo) return saveDemo({ id: "development-wedding", ...input }, []);
    const { error: e } = await requireBackend().rpc("create_wedding", {
      p_one: input.partner_one,
      p_two: input.partner_two,
      p_date: input.wedding_date,
      p_budget: input.budget,
    });
    if (e)
      throw Error(
        "יצירת החתונה נכשלה. ודאו שהחשבון מאומת ושאין לכם חתונה קיימת.",
      );
    await reload();
  }
  async function joinWedding(token: string) {
    if (isDemo)
      throw Error("הצטרפות זוגית דורשת חשבון אמיתי וחיבור לשירות הנתונים.");
    const { error: e } = await requireBackend().rpc("accept_invite", {
      p_token: token.trim(),
    });
    if (e)
      throw Error(
        "לא ניתן להצטרף. בדקו שהקוד תקין, בתוקף ושאינכם משויכים לחתונה אחרת.",
      );
    await reload();
  }
  async function addTask(title: string, recommendationKey?: string) {
    if (!wedding) throw Error("יש להגדיר חתונה תחילה.");
    const valid = validateTitle(title);
    if (
      recommendationKey &&
      tasks.some((t) => t.recommendation_key === recommendationKey)
    )
      return;
    if (isDemo)
      return saveDemo(wedding, [
        ...tasks,
        {
          id: `local-${Date.now()}-${Math.random()}`,
          wedding_id: wedding.id,
          title: valid,
          owner: "both",
          completed: false,
          recommendation_key: recommendationKey ?? null,
          version: 1,
        },
      ]);
    const { error: e } = await requireBackend()
      .from("tasks")
      .insert({
        wedding_id: wedding.id,
        title: valid,
        recommendation_key: recommendationKey ?? null,
      });
    if (e && e.code !== "23505") throw Error("שמירת המשימה נכשלה. נסו שוב.");
    await reload();
  }
  async function toggleTask(task: Task) {
    if (isDemo)
      return saveDemo(
        wedding,
        tasks.map((t) =>
          t.id === task.id
            ? { ...t, completed: !t.completed, version: t.version + 1 }
            : t,
        ),
      );
    const { data, error: e } = await requireBackend()
      .from("tasks")
      .update({ completed: !task.completed })
      .eq("id", task.id)
      .eq("version", task.version)
      .select("id");
    if (e) throw Error("העדכון לא נשמר. נסו שוב.");
    await reload();
    if (!data?.length)
      throw Error(
        "המשימה עודכנה ממכשיר אחר. הרשימה רועננה; בדקו את המצב לפני שינוי נוסף.",
      );
  }
  async function resetDemo() {
    if (!isDemo) throw Error("זמין בפיתוח בלבד.");
    await AsyncStorage.removeItem(DEMO_KEY);
    setWedding(null);
    setTasks([]);
  }
  return (
    <Context.Provider
      value={{
        wedding,
        tasks,
        loading,
        error,
        reload,
        createWedding,
        joinWedding,
        addTask,
        toggleTask,
        resetDemo,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWedding() {
  const value = useContext(Context);
  if (!value) throw Error("WeddingProvider missing");
  return value;
}
