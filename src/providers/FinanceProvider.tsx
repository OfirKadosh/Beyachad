import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { Wedding } from "../core/domain";
import {
  deletePaymentState,
  deleteVendorState,
  financeConflict,
  savePaymentState,
  saveVendorState,
  validatePayment,
  validateVendor,
  type FinanceState,
  type Payment,
  type PaymentDraft,
  type Vendor,
  type VendorDraft,
} from "../core/finance";
import { backend, requireBackend } from "../services/backend";
import { mutateWorkspace, readWorkspace } from "../services/workspace";
import { useAuth } from "./AuthProvider";
import { useWedding } from "./WeddingProvider";
type Store = FinanceState & {
  loading: boolean;
  error: string;
  reload(): Promise<boolean>;
  saveVendor(
    id: string,
    original: Vendor | null,
    draft: VendorDraft,
  ): Promise<void>;
  deleteVendor(vendor: Vendor): Promise<void>;
  savePayment(
    id: string,
    vendor: Vendor,
    original: Payment | null,
    draft: PaymentDraft,
  ): Promise<void>;
  deletePayment(vendor: Vendor, payment: Payment): Promise<void>;
  setBudget(original: Wedding, budget: number | null): Promise<void>;
};
const Context = createContext<Store | null>(null);
export function FinanceProvider({ children }: PropsWithChildren) {
  const { isDemo } = useAuth();
  const { wedding, reload: reloadWedding } = useWedding();
  const weddingId = wedding?.id;
  const [state, setState] = useState<FinanceState>({
    vendors: [],
    payments: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const reload = useCallback(async () => {
    const request = ++revision.current;
    try {
      let next: FinanceState;
      if (!weddingId) {
        await Promise.resolve();
        next = { vendors: [], payments: [] };
      } else if (isDemo) {
        const data = await readWorkspace();
        next = { vendors: data.vendors, payments: data.payments };
      } else {
        const db = requireBackend();
        const [vendors, payments] = await Promise.all([
          db
            .from("vendors")
            .select("*")
            .eq("wedding_id", weddingId)
            .order("name"),
          db.from("payments").select("*").eq("wedding_id", weddingId),
        ]);
        if (vendors.error || payments.error) throw Error("load");
        next = { vendors: vendors.data ?? [], payments: payments.data ?? [] };
      }
      if (request === revision.current) {
        setState(next);
        setError("");
      }
      return true;
    } catch {
      if (request === revision.current)
        setError(
          "לא ניתן לטעון ספקים ותשלומים. בדקו חיבור ושקובץ שדרוג מסד הנתונים הופעל.",
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
    // Fetching external state, not deriving state from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    return invalidate;
  }, [reload, invalidate]);
  useEffect(() => {
    if (isDemo || !backend || !weddingId) return;
    const channel = backend
      .channel(`finance-${weddingId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendors" },
        () => {
          void reload();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => {
          void reload();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "weddings",
          filter: `id=eq.${weddingId}`,
        },
        () => {
          void reloadWedding();
        },
      );
    channel.subscribe();
    return () => {
      void backend?.removeChannel(channel);
    };
  }, [isDemo, weddingId, reload, reloadWedding]);
  async function local(change: (current: FinanceState) => FinanceState) {
    const next = await mutateWorkspace((current) => {
      if (current.wedding?.id !== weddingId) throw Error(financeConflict);
      return { ...current, ...change(current) };
    });
    revision.current++;
    setState({ vendors: next.vendors, payments: next.payments });
  }
  async function rpc(name: string, parameters: Record<string, unknown>) {
    const result = await requireBackend().rpc(name, parameters);
    if (result.error) {
      if (result.error.code === "40001") throw Error(financeConflict);
      if (result.error.code === "P0001") throw Error(result.error.message);
      throw Error(
        "השמירה לא הושלמה. בדקו את הנתונים, החיבור ושדרוג מסד הנתונים.",
      );
    }
    if (!(await reload()))
      throw Error("השמירה התקבלה אך הרענון נכשל. נסו לרענן לפני רישום נוסף.");
  }
  async function safely(action: () => Promise<void>) {
    try {
      await action();
    } catch (e) {
      await Promise.all([reload(), reloadWedding()]);
      throw e;
    }
  }
  async function saveVendor(
    id: string,
    original: Vendor | null,
    input: VendorDraft,
  ) {
    const valid = validateVendor(input);
    if (!weddingId) throw Error("יש להגדיר חתונה תחילה.");
    await safely(async () => {
      if (isDemo)
        await local((s) =>
          saveVendorState(s, id, weddingId, original?.version ?? null, valid),
        );
      else
        await rpc("save_vendor", {
          p_id: id,
          p_wedding_id: weddingId,
          p_expected_version: original?.version ?? null,
          p_name: valid.name,
          p_category: valid.category,
          p_status: valid.status,
          p_contact: valid.contact,
          p_phone: valid.phone,
          p_quote_cents: valid.quote_cents,
          p_agreed_cents: valid.agreed_cents,
          p_notes: valid.notes,
        });
    });
  }
  async function deleteVendor(vendor: Vendor) {
    await safely(async () => {
      if (isDemo) await local((s) => deleteVendorState(s, vendor));
      else
        await rpc("delete_vendor", {
          p_id: vendor.id,
          p_expected_version: vendor.version,
        });
    });
  }
  async function savePayment(
    id: string,
    vendor: Vendor,
    original: Payment | null,
    input: PaymentDraft,
  ) {
    const valid = validatePayment(input);
    await safely(async () => {
      if (isDemo)
        await local((s) =>
          savePaymentState(s, vendor, id, original?.version ?? null, valid),
        );
      else
        await rpc("save_payment", {
          p_id: id,
          p_vendor_id: vendor.id,
          p_vendor_version: vendor.version,
          p_expected_version: original?.version ?? null,
          p_label: valid.label,
          p_amount_cents: valid.amount_cents,
          p_due_date: valid.due_date,
          p_paid_date: valid.paid_date,
        });
    });
  }
  async function deletePayment(vendor: Vendor, payment: Payment) {
    await safely(async () => {
      if (isDemo) await local((s) => deletePaymentState(s, vendor, payment));
      else
        await rpc("delete_payment", {
          p_id: payment.id,
          p_vendor_version: vendor.version,
          p_expected_version: payment.version,
        });
    });
  }
  async function setBudget(original: Wedding, budget: number | null) {
    await safely(async () => {
      if (isDemo)
        await mutateWorkspace((current) => {
          if (
            current.wedding?.id !== original.id ||
            (current.wedding.budget_version ?? 1) !==
              (original.budget_version ?? 1)
          )
            throw Error(financeConflict);
          return {
            ...current,
            wedding: {
              ...current.wedding,
              budget,
              budget_version: (current.wedding.budget_version ?? 1) + 1,
            },
          };
        });
      else
        await rpc("set_wedding_budget", {
          p_wedding_id: original.id,
          p_expected_version: original.budget_version ?? 1,
          p_budget: budget,
        });
      await reloadWedding();
    });
  }
  return (
    <Context.Provider
      value={{
        ...state,
        loading,
        error,
        reload,
        saveVendor,
        deleteVendor,
        savePayment,
        deletePayment,
        setBudget,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useFinance() {
  const value = useContext(Context);
  if (!value) throw Error("FinanceProvider missing");
  return value;
}
