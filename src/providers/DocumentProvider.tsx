import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Linking, Platform } from "react-native";
import { openLocalDocument } from "../services/documentFiles";
import * as Crypto from "expo-crypto";
import {
  base64ToBytes,
  bytesToBase64,
  validateDocument,
  type WeddingDocument,
} from "../core/documents";
import { loadGuestPages } from "../core/guestPages";
import { useAuth } from "./AuthProvider";
import { useWedding } from "./WeddingProvider";
import { backend, requireBackend } from "../services/backend";
import { mutateWorkspace, readWorkspace } from "../services/workspace";
type Store = {
  documents: WeddingDocument[];
  loading: boolean;
  error: string;
  reload(): Promise<void>;
  upload(
    name: string,
    mime: string,
    bytes: Uint8Array,
    vendorId: string | null,
    paymentId: string | null,
  ): Promise<void>;
  remove(doc: WeddingDocument): Promise<void>;
  open(doc: WeddingDocument): Promise<string | null>;
};
const Context = createContext<Store | null>(null);
export function DocumentProvider({ children }: PropsWithChildren) {
  const { isDemo } = useAuth(),
    { wedding } = useWedding(),
    id = wedding?.id;
  const [documents, setDocuments] = useState<WeddingDocument[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const revision = useRef(0);
  const reload = useCallback(async () => {
    const request = ++revision.current;
    try {
      let next: WeddingDocument[] = [];
      if (id) {
        if (isDemo) next = (await readWorkspace()).documents;
        else
          next = await loadGuestPages<WeddingDocument>(async (from, to) => {
            const {
              data,
              count,
              error: e,
            } = await requireBackend()
              .from("documents")
              .select("*", { count: "exact" })
              .eq("wedding_id", id)
              .order("id")
              .range(from, to);
            if (e) throw e;
            return { rows: data ?? [], count };
          });
      }
      if (request === revision.current) {
        setDocuments(next);
        setError("");
      }
    } catch {
      if (request === revision.current)
        setError("טעינת המסמכים נכשלה. בדקו חיבור ושדרוג נתונים 006.");
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }, [id, isDemo]);
  const invalidate = useCallback(() => {
    revision.current++;
  }, []);
  useEffect(() => {
    // Synchronize asynchronous persisted/API state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    return invalidate;
  }, [reload, invalidate]);
  useEffect(() => {
    if (isDemo || !id || !backend) return;
    const channel = backend
      .channel(`documents-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        () => {
          void reload();
        },
      )
      .subscribe();
    return () => {
      void backend?.removeChannel(channel);
    };
  }, [id, isDemo, reload]);
  async function upload(
    name: string,
    mime: string,
    bytes: Uint8Array,
    vendorId: string | null,
    paymentId: string | null,
  ) {
    if (!id) throw Error("יש להגדיר מרחב תחילה.");
    const valid = validateDocument(name, mime, bytes),
      writeId = Crypto.randomUUID(),
      base64 = bytesToBase64(bytes);
    if (isDemo) {
      await mutateWorkspace((current) => {
        if (current.wedding?.id !== id) throw Error("המרחב השתנה.");
        if (current.documents.length >= 100)
          throw Error("ניתן לשמור עד 100 מסמכים.");
        if (vendorId && !current.vendors.some((v) => v.id === vendorId))
          throw Error("הספק אינו ברשימה.");
        if (
          paymentId &&
          !current.payments.some(
            (p) => p.id === paymentId && p.vendor_id === vendorId,
          )
        )
          throw Error("התשלום אינו ברשימה.");
        return {
          ...current,
          documents: [
            ...current.documents,
            {
              id: writeId,
              wedding_id: id,
              ...valid,
              vendor_id: vendorId,
              payment_id: paymentId,
              created_at: new Date().toISOString(),
              base64,
            },
          ],
        };
      });
    } else {
      const { data, error: e } = await requireBackend().functions.invoke(
        "documents",
        {
          body: {
            action: "upload",
            id: writeId,
            weddingId: id,
            name: valid.name,
            mime,
            base64,
            vendorId,
            paymentId,
          },
        },
      );
      if (e || !data?.ok)
        throw Error(
          "העלאת המסמך נכשלה. בדקו חיבור, מקום אחסון והפעלת שירות המסמכים.",
        );
    }
    await reload();
  }
  async function remove(doc: WeddingDocument) {
    if (isDemo)
      await mutateWorkspace((c) => ({
        ...c,
        documents: c.documents.filter((d) => d.id !== doc.id),
      }));
    else {
      const { data, error: e } = await requireBackend().functions.invoke(
        "documents",
        { body: { action: "remove", id: doc.id, weddingId: doc.wedding_id } },
      );
      if (e || !data?.ok) throw Error("המחיקה לא הושלמה. נסו שוב.");
    }
    await reload();
  }
  async function open(doc: WeddingDocument) {
    if (isDemo) {
      const local = (await readWorkspace()).documents.find(
        (d) => d.id === doc.id,
      );
      if (!local) throw Error("המסמך אינו זמין.");
      validateDocument(
        local.name,
        local.mime_type,
        base64ToBytes(local.base64),
      );
      return openLocalDocument(
        base64ToBytes(local.base64),
        local.name,
        local.mime_type,
      );
    }
    const { data, error: e } = await requireBackend()
      .storage.from("wedding-documents")
      .createSignedUrl(`${doc.wedding_id}/${doc.id}`, 60);
    if (e || !data?.signedUrl)
      throw Error("לא ניתן לפתוח את המסמך. נסו לרענן.");
    if (Platform.OS === "web") return data.signedUrl;
    await Linking.openURL(data.signedUrl);
    return null;
  }
  return (
    <Context.Provider
      value={{ documents, loading, error, reload, upload, remove, open }}
    >
      {children}
    </Context.Provider>
  );
}
export function useDocuments() {
  const context = useContext(Context);
  if (!context) throw Error("DocumentProvider missing");
  return context;
}
