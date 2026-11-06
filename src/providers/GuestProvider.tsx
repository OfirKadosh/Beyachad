import {
  runGuestImport,
  type ImportEntry,
  type ImportResult,
} from "../core/guestTransfer";
import { loadGuestPages } from "../core/guestPages";
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
  deleteGuestState,
  guestConflict,
  saveGuestState,
  validateGuest,
  type GuestDraft,
  type GuestInvitation,
} from "../core/guests";
import { backend, requireBackend } from "../services/backend";
import { mutateWorkspace, readWorkspace } from "../services/workspace";
import { useAuth } from "./AuthProvider";
import { useWedding } from "./WeddingProvider";

function guestArgs(
  id: string,
  weddingId: string,
  original: GuestInvitation | null,
  valid: GuestDraft,
) {
  return {
    p_id: id,
    p_wedding_id: weddingId,
    p_expected_version: original?.version ?? null,
    p_name: valid.name,
    p_contact: valid.contact,
    p_phone: valid.phone,
    p_side: valid.side,
    p_group_name: valid.group_name,
    p_invited_adults: valid.invited_adults,
    p_invited_children: valid.invited_children,
    p_rsvp: valid.rsvp,
    p_confirmed_adults: valid.confirmed_adults,
    p_confirmed_children: valid.confirmed_children,
    p_dietary: valid.dietary,
    p_notes: valid.notes,
  };
}
type Store = {
  guests: GuestInvitation[];
  loading: boolean;
  error: string;
  reload(): Promise<boolean>;
  saveGuest(
    id: string,
    original: GuestInvitation | null,
    draft: GuestDraft,
  ): Promise<void>;
  deleteGuest(original: GuestInvitation): Promise<void>;
  importGuests(
    entries: ImportEntry[],
    report: (result: ImportResult) => void,
  ): Promise<void>;
};
const Context = createContext<Store | null>(null);
export function GuestProvider({ children }: PropsWithChildren) {
  const { isDemo } = useAuth();
  const { wedding } = useWedding();
  const weddingId = wedding?.id;
  const [guests, setGuests] = useState<GuestInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const knownIds = useRef(new Set<string>());
  const importBusy = useRef(false);
  const scope = useRef(0);
  useEffect(() => {
    const generation = ++scope.current;
    return () => {
      scope.current = generation + 1;
    };
  }, [weddingId, isDemo]);
  const readCurrent = useCallback(async (): Promise<GuestInvitation[]> => {
    if (!weddingId) return [];
    if (isDemo) return (await readWorkspace()).guests;
    return loadGuestPages(async (from, to) => {
      const {
        data,
        count,
        error: e,
      } = await requireBackend()
        .from("guest_invitations")
        .select("*", { count: "exact" })
        .eq("wedding_id", weddingId)
        .order("id")
        .range(from, to);
      if (e) throw e;
      return { rows: data ?? [], count };
    });
  }, [isDemo, weddingId]);
  const reload = useCallback(async () => {
    const request = ++revision.current;
    try {
      const next = await readCurrent();
      if (request === revision.current) {
        setGuests(next);
        knownIds.current = new Set(next.map((g) => g.id));
        setError("");
      }
      return true;
    } catch {
      if (request === revision.current)
        setError(
          "טעינת המוזמנים נכשלה. בדקו חיבור וששדרוג מסד הנתונים 004 הופעל.",
        );
      return false;
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }, [readCurrent]);
  const invalidate = useCallback(() => {
    revision.current++;
  }, []);
  useEffect(() => {
    // Loads asynchronous external state, not derived render state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    return invalidate;
  }, [reload, invalidate]);
  useEffect(() => {
    if (isDemo || !weddingId || !backend) return;
    const channel = backend
      .channel(`guests-${weddingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "guest_invitations",
          filter: `wedding_id=eq.${weddingId}`,
        },
        () => {
          if (!importBusy.current) void reload();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "guest_invitations",
          filter: `wedding_id=eq.${weddingId}`,
        },
        () => {
          if (!importBusy.current) void reload();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "guest_invitations" },
        (event) => {
          if (knownIds.current.has(String(event.old.id)))
            if (!importBusy.current) void reload();
        },
      );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") if (!importBusy.current) void reload();
    });
    return () => {
      void backend?.removeChannel(channel);
    };
  }, [isDemo, weddingId, reload]);
  async function local(
    change: (current: GuestInvitation[]) => GuestInvitation[],
  ) {
    const saved = await mutateWorkspace((current) => {
      if (current.wedding?.id !== weddingId) throw Error(guestConflict);
      return { ...current, guests: change(current.guests) };
    });
    revision.current++;
    knownIds.current = new Set(saved.guests.map((g) => g.id));
    setGuests(saved.guests);
  }
  async function rpc(
    name: string,
    args: Record<string, unknown>,
    refresh = true,
  ) {
    const { error: e } = await requireBackend().rpc(name, args);
    if (e) {
      if (e.code === "40001") throw Error(guestConflict);
      if (e.code === "P0001") throw Error(e.message);
      throw Error(
        "לא ניתן לשמור את ההזמנה. בדקו את הנתונים ואת שדרוג מסד הנתונים.",
      );
    }
    if (refresh && !(await reload()))
      throw Error(
        "השמירה התקבלה אך הרענון נכשל. רעננו לפני הוספת הזמנה נוספת.",
      );
  }
  async function safely(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      await reload();
      throw e;
    }
  }
  async function saveGuest(
    id: string,
    original: GuestInvitation | null,
    input: GuestDraft,
  ) {
    const valid = validateGuest(input);
    if (!weddingId) throw Error("יש להגדיר חתונה תחילה.");
    await safely(async () => {
      if (isDemo)
        await local((current) =>
          saveGuestState(
            current,
            id,
            weddingId,
            original?.version ?? null,
            valid,
          ),
        );
      else await rpc("save_guest", guestArgs(id, weddingId, original, valid));
    });
  }
  async function importGuests(
    entries: ImportEntry[],
    report: (result: ImportResult) => void,
  ) {
    if (!weddingId) throw Error("יש להגדיר חתונה תחילה.");
    if (importBusy.current) throw Error("ייבוא כבר מתבצע. המתינו לסיום.");
    if (entries.length > 500) throw Error("ניתן לייבא עד 500 הזמנות בכל פעם.");
    importBusy.current = true;
    const started = scope.current;
    try {
      const current = await readCurrent();
      await runGuestImport(
        entries,
        current,
        async ({ id, draft }) => {
          if (scope.current !== started)
            throw Error("המרחב השתנה. הייבוא נעצר.");
          if (isDemo)
            await local((rows) =>
              saveGuestState(rows, id, weddingId, null, draft),
            );
          else
            await rpc(
              "save_guest",
              guestArgs(id, weddingId, null, draft),
              false,
            );
        },
        report,
      );
    } finally {
      importBusy.current = false;
      if (scope.current === started) await reload();
    }
  }
  async function deleteGuest(original: GuestInvitation) {
    await safely(async () => {
      if (isDemo) await local((current) => deleteGuestState(current, original));
      else
        await rpc("delete_guest", {
          p_id: original.id,
          p_expected_version: original.version,
        });
    });
  }
  return (
    <Context.Provider
      value={{
        guests,
        loading,
        error,
        reload,
        saveGuest,
        deleteGuest,
        importGuests,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useGuests() {
  const value = useContext(Context);
  if (!value) throw Error("GuestProvider missing");
  return value;
}
