import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { readWorkspace, mutateWorkspace } from "../services/workspace";
import { type Task, type Wedding } from "../core/domain";
import {
  conflictMessage,
  emptyTask,
  normalizeTask,
  removeTask,
  replaceTask,
  validateTask,
  type MemberSlot,
  type TaskDraft,
} from "../core/tasks";
import { backend, requireBackend } from "../services/backend";
import { useAuth } from "./AuthProvider";
type Setup = Omit<Wedding, "id">;
type Store = {
  wedding: Wedding | null;
  tasks: Task[];
  viewerSlot: MemberSlot;
  loading: boolean;
  error: string;
  reload(): Promise<void>;
  createWedding(input: Setup): Promise<void>;
  joinWedding(token: string): Promise<void>;
  addTask(title: string, recommendationKey?: string): Promise<void>;
  createTask(input: TaskDraft): Promise<void>;
  updateTask(task: Task, input: TaskDraft): Promise<void>;
  deleteTask(task: Task): Promise<void>;
  toggleTask(task: Task): Promise<void>;
  resetDemo(): Promise<void>;
};
const Context = createContext<Store | null>(null);
export function WeddingProvider({ children }: PropsWithChildren) {
  const { userId, isDemo } = useAuth();
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewerSlot, setViewerSlot] = useState<MemberSlot>("one");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const result = writes.current.then(fn, fn);
    writes.current = result.catch(() => {});
    return result;
  }
  const reload = useCallback(async () => {
    const current = ++generation.current;
    try {
      if (isDemo) {
        const workspace = await readWorkspace();
        if (current !== generation.current) return;
        const data = workspace;
        setWedding(data.wedding);
        setTasks(data.tasks.map(normalizeTask));
      } else if (userId) {
        const db = requireBackend();
        const { data, error: e } = await db
          .from("weddings")
          .select(
            "id, partner_one, partner_two, wedding_date, budget, budget_version",
          )
          .maybeSingle();
        if (e) throw e;
        const [result, membership] = data
          ? await Promise.all([
              db
                .from("tasks")
                .select("*")
                .eq("wedding_id", data.id)
                .order("created_at"),
              db
                .from("wedding_members")
                .select("role")
                .eq("wedding_id", data.id)
                .eq("user_id", userId)
                .single(),
            ])
          : [
              { data: [], error: null },
              { data: null, error: null },
            ];
        if (result.error || membership.error)
          throw result.error || membership.error;
        if (current !== generation.current) return;
        setWedding(data);
        setTasks((result.data ?? []).map(normalizeTask));
        setViewerSlot(membership.data?.role === "partner" ? "two" : "one");
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
    // Synchronizes asynchronous storage/API results rather than derived render state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    return invalidate;
  }, [reload, invalidate]);
  const weddingId = wedding?.id;
  useEffect(() => {
    if (isDemo || !weddingId || !backend) return;
    // DELETE events cannot reliably use row filters; RLS and reload scope protect reads.
    const channel = backend
      .channel(`wedding-${weddingId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => {
          void reload();
        },
      )
      .subscribe();
    return () => {
      void backend?.removeChannel(channel);
    };
  }, [isDemo, weddingId, reload]);
  async function saveDemo(nextWedding: Wedding | null, nextTasks: Task[]) {
    const saved = await mutateWorkspace((current) => ({
      ...current,
      wedding:
        nextWedding && current.wedding?.id === nextWedding.id
          ? {
              ...nextWedding,
              budget: current.wedding.budget,
              budget_version: current.wedding.budget_version,
            }
          : nextWedding,
      tasks: nextTasks,
    }));
    generation.current++;
    setWedding(saved.wedding);
    setTasks(nextTasks);
  }
  async function localTasks() {
    return (await readWorkspace()).tasks.map(normalizeTask);
  }
  async function createWedding(input: Setup) {
    if (isDemo)
      return serialize(() =>
        saveDemo({ id: "development-wedding", ...input }, []),
      );
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
  async function insertTask(input: TaskDraft, recommendationKey?: string) {
    const valid = validateTask(input);
    return serialize(async () => {
      if (!wedding) throw Error("יש להגדיר חתונה תחילה.");
      if (isDemo) {
        const current = await localTasks();
        if (
          recommendationKey &&
          current.some((t) => t.recommendation_key === recommendationKey)
        )
          return;
        return saveDemo(wedding, [
          ...current,
          {
            ...valid,
            id: `local-${Date.now()}-${Math.random()}`,
            wedding_id: wedding.id,
            completed: valid.status === "done",
            recommendation_key: recommendationKey ?? null,
            version: 1,
          },
        ]);
      }
      const { error: e } = await requireBackend()
        .from("tasks")
        .insert({
          ...valid,
          wedding_id: wedding.id,
          recommendation_key: recommendationKey ?? null,
        });
      if (e && !(recommendationKey && e.code === "23505"))
        throw Error(
          "שמירת המשימה נכשלה. ודאו ששדרוג מסד הנתונים בוצע ונסו שוב.",
        );
      await reload();
    });
  }
  async function addTask(title: string, key?: string) {
    await insertTask({ ...emptyTask(), title }, key);
  }
  async function createTask(input: TaskDraft) {
    await insertTask(input);
  }
  async function updateTask(task: Task, input: TaskDraft) {
    const valid = validateTask(input);
    return serialize(async () => {
      if (isDemo) {
        try {
          await saveDemo(wedding, replaceTask(await localTasks(), task, valid));
        } catch (e) {
          await reload();
          throw e;
        }
        return;
      }
      const { data, error: e } = await requireBackend()
        .from("tasks")
        .update(valid)
        .eq("id", task.id)
        .eq("wedding_id", task.wedding_id)
        .eq("version", task.version)
        .select("id");
      if (e)
        throw Error("העדכון לא נשמר. ודאו ששדרוג מסד הנתונים בוצע ונסו שוב.");
      await reload();
      if (!data?.length) throw Error(conflictMessage);
    });
  }
  async function deleteTask(task: Task) {
    return serialize(async () => {
      if (isDemo) {
        try {
          await saveDemo(wedding, removeTask(await localTasks(), task));
        } catch (e) {
          await reload();
          throw e;
        }
        return;
      }
      const { data, error: e } = await requireBackend()
        .from("tasks")
        .delete()
        .eq("id", task.id)
        .eq("wedding_id", task.wedding_id)
        .eq("version", task.version)
        .select("id");
      if (e) throw Error("המחיקה לא נשמרה. נסו שוב.");
      await reload();
      if (!data?.length) throw Error(conflictMessage);
    });
  }
  async function toggleTask(task: Task) {
    await updateTask(task, {
      ...task,
      status: task.status === "done" ? "todo" : "done",
    });
  }
  async function resetDemo() {
    if (!isDemo) throw Error("זמין בפיתוח בלבד.");
    await serialize(async () => {
      await mutateWorkspace(() => ({
        wedding: null,
        tasks: [],
        vendors: [],
        payments: [],
        guests: [],
      }));
      generation.current++;
      setWedding(null);
      setTasks([]);
    });
  }
  return (
    <Context.Provider
      value={{
        wedding,
        tasks,
        viewerSlot,
        loading,
        error,
        reload,
        createWedding,
        joinWedding,
        addTask,
        createTask,
        updateTask,
        deleteTask,
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
