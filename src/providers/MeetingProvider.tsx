import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  deleteMeetingState,
  meetingConflict,
  saveMeetingState,
  validateMeeting,
  type Meeting,
  type MeetingDraft,
} from "../core/meetings";
import { backend, requireBackend } from "../services/backend";
import { mutateWorkspace, readWorkspace } from "../services/workspace";
import { useAuth } from "./AuthProvider";
import { useWedding } from "./WeddingProvider";
import { useFinance } from "./FinanceProvider";
type Store = {
  meetings: Meeting[];
  loading: boolean;
  error: string;
  reload(): Promise<boolean>;
  saveMeeting(
    id: string,
    original: Meeting | null,
    input: MeetingDraft,
  ): Promise<void>;
  deleteMeeting(original: Meeting): Promise<void>;
};
const Context = createContext<Store | null>(null);
export function MeetingProvider({ children }: PropsWithChildren) {
  const { isDemo } = useAuth(),
    { wedding } = useWedding(),
    { vendors } = useFinance();
  const weddingId = wedding?.id;
  const vendorIds = vendors
    .map((v) => v.id)
    .sort()
    .join(",");
  const [meetings, setMeetings] = useState<Meeting[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const revision = useRef(0),
    known = useRef(new Set<string>());
  const reload = useCallback(async () => {
    const request = ++revision.current;
    try {
      let rows: Meeting[] = [];
      if (!weddingId) await Promise.resolve();
      else if (isDemo) rows = (await readWorkspace()).meetings;
      else {
        let offset = 0;
        for (;;) {
          const {
            data,
            count,
            error: e,
          } = await requireBackend()
            .from("meetings")
            .select("*", { count: "exact" })
            .eq("wedding_id", weddingId)
            .order("id")
            .range(offset, offset + 499);
          if (e) throw e;
          rows.push(...(data ?? []));
          offset += data?.length ?? 0;
          if (count !== null ? offset >= count : (data?.length ?? 0) < 500)
            break;
          if (!data?.length) throw Error("Incomplete meetings");
        }
      }
      if (request === revision.current) {
        setMeetings(rows);
        known.current = new Set(rows.map((m) => m.id));
        setError("");
      }
      return true;
    } catch {
      if (request === revision.current)
        setError(
          "לא ניתן לטעון פגישות. בדקו חיבור וששדרוג מסד הנתונים 005 הופעל.",
        );
      return false;
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }, [isDemo, weddingId]);
  const invalidate = useCallback(() => {
    revision.current++;
  }, []);
  useEffect(() => {
    // External async storage/API synchronization; vendor deletion can unlink meetings.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    return invalidate;
  }, [reload, invalidate, vendorIds]);
  useEffect(() => {
    if (isDemo || !weddingId || !backend) return;
    const channel = backend
      .channel(`meetings-${weddingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "meetings",
          filter: `wedding_id=eq.${weddingId}`,
        },
        () => {
          void reload();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "meetings",
          filter: `wedding_id=eq.${weddingId}`,
        },
        () => {
          void reload();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "meetings" },
        (e) => {
          if (known.current.has(String(e.old.id))) void reload();
        },
      );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") void reload();
    });
    return () => {
      void backend?.removeChannel(channel);
    };
  }, [isDemo, weddingId, reload]);
  async function local(change: (rows: Meeting[]) => Meeting[]) {
    const saved = await mutateWorkspace((current) => {
      if (current.wedding?.id !== weddingId) throw Error(meetingConflict);
      const next = change(current.meetings);
      if (
        next.some(
          (m) =>
            m.vendor_id && !current.vendors.some((v) => v.id === m.vendor_id),
        )
      )
        throw Error("הספק נמחק. פתחו את הפגישה מחדש ובחרו ספק קיים.");
      return { ...current, meetings: next };
    });
    revision.current++;
    known.current = new Set(saved.meetings.map((m) => m.id));
    setMeetings(saved.meetings);
  }
  async function rpc(name: string, args: Record<string, unknown>) {
    const { error: e } = await requireBackend().rpc(name, args);
    if (e) {
      if (e.code === "40001") throw Error(meetingConflict);
      if (e.code === "P0001") throw Error(e.message);
      throw Error("שמירת הפגישה נכשלה. בדקו את הנתונים ושדרוג מסד הנתונים.");
    }
    if (!(await reload()))
      throw Error("השמירה התקבלה אך הרענון נכשל. רעננו לפני רישום נוסף.");
  }
  async function safely(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      await reload();
      throw e;
    }
  }
  async function saveMeeting(
    id: string,
    original: Meeting | null,
    input: MeetingDraft,
  ) {
    const valid = validateMeeting(input);
    if (!weddingId) throw Error("יש להגדיר חתונה תחילה.");
    await safely(async () => {
      if (isDemo)
        await local((rows) =>
          saveMeetingState(
            rows,
            id,
            weddingId,
            original?.version ?? null,
            valid,
          ),
        );
      else
        await rpc("save_meeting", {
          p_id: id,
          p_wedding_id: weddingId,
          p_expected_version: original?.version ?? null,
          p_title: valid.title,
          p_starts_at: valid.starts_at,
          p_time_zone: valid.time_zone,
          p_duration_minutes: valid.duration_minutes,
          p_location: valid.location,
          p_vendor_id: valid.vendor_id,
          p_owner: valid.owner,
          p_status: valid.status,
          p_reminder_minutes: valid.reminder_minutes,
          p_notes: valid.notes,
        });
    });
  }
  async function deleteMeeting(original: Meeting) {
    await safely(async () => {
      if (isDemo) await local((rows) => deleteMeetingState(rows, original));
      else
        await rpc("delete_meeting", {
          p_id: original.id,
          p_expected_version: original.version,
        });
    });
  }
  return (
    <Context.Provider
      value={{ meetings, loading, error, reload, saveMeeting, deleteMeeting }}
    >
      {children}
    </Context.Provider>
  );
}
export function useMeetings() {
  const value = useContext(Context);
  if (!value) throw Error("MeetingProvider missing");
  return value;
}
