import { parseDate } from "./domain";
import { MAX_CENTS } from "./money";
import { localDateKey } from "./tasks";
export const vendorCategories = {
  venue: "אולם וקייטרינג",
  photo: "צילום",
  music: "מוזיקה",
  design: "עיצוב",
  clothing: "לבוש וטיפוח",
  other: "אחר",
} as const;
export const vendorStatuses = {
  researching: "בבדיקה",
  quoted: "התקבלה הצעה",
  booked: "נסגר",
  rejected: "לא נבחר",
} as const;
export type VendorDraft = {
  name: string;
  category: keyof typeof vendorCategories;
  status: keyof typeof vendorStatuses;
  contact: string;
  phone: string;
  quote_cents: number | null;
  agreed_cents: number | null;
  notes: string;
};
export type Vendor = VendorDraft & {
  id: string;
  wedding_id: string;
  version: number;
};
export type PaymentDraft = {
  label: string;
  amount_cents: number;
  due_date: string | null;
  paid_date: string | null;
};
export type Payment = PaymentDraft & {
  id: string;
  vendor_id: string;
  wedding_id: string;
  version: number;
};
export type FinanceState = { vendors: Vendor[]; payments: Payment[] };
export const financeConflict =
  "הרישום השתנה ממכשיר אחר. הנתונים רועננו; פתחו את הכרטיס מחדש לפני שמירה.";
export function emptyVendor(): VendorDraft {
  return {
    name: "",
    category: "other",
    status: "researching",
    contact: "",
    phone: "",
    quote_cents: null,
    agreed_cents: null,
    notes: "",
  };
}
function cents(value: number | null, required = false) {
  if (value === null && !required) return;
  if (!Number.isSafeInteger(value) || value! < 0 || value! > MAX_CENTS)
    throw Error("סכום לא תקין.");
}
export function validateVendor(input: VendorDraft): VendorDraft {
  if (!input.name.trim() || input.name.trim().length > 100)
    throw Error("יש להזין שם ספק עד 100 תווים.");
  if (
    !Object.hasOwn(vendorCategories, input.category) ||
    !Object.hasOwn(vendorStatuses, input.status)
  )
    throw Error("יש לבחור קטגוריה ומצב תקינים.");
  if (
    input.contact.length > 100 ||
    input.phone.length > 40 ||
    input.notes.length > 2000
  )
    throw Error("פרטי הספק ארוכים מדי.");
  cents(input.quote_cents);
  cents(input.agreed_cents, input.status === "booked");
  return {
    name: input.name.trim(),
    category: input.category,
    status: input.status,
    contact: input.contact.trim(),
    phone: input.phone.trim(),
    quote_cents: input.quote_cents,
    agreed_cents: input.agreed_cents,
    notes: input.notes.trim(),
  };
}
export function validatePayment(input: PaymentDraft): PaymentDraft {
  if (!input.label.trim() || input.label.trim().length > 100)
    throw Error("יש להזין תיאור תשלום עד 100 תווים.");
  cents(input.amount_cents, true);
  if (!input.amount_cents) throw Error("סכום התשלום חייב להיות גדול מאפס.");
  const due = parseDate(input.due_date ?? ""),
    paid = parseDate(input.paid_date ?? "");
  if (!due && !paid) throw Error("לתשלום מתוכנן יש להגדיר תאריך יעד.");
  return {
    label: input.label.trim(),
    amount_cents: input.amount_cents,
    due_date: due,
    paid_date: paid,
  };
}
export function vendorTotals(vendor: Vendor, payments: Payment[]) {
  const entries = payments.filter((p) => p.vendor_id === vendor.id);
  const paid = entries
    .filter((p) => p.paid_date !== null)
    .reduce((n, p) => n + p.amount_cents, 0);
  const scheduled = entries
    .filter((p) => p.paid_date === null)
    .reduce((n, p) => n + p.amount_cents, 0);
  const committed = vendor.status === "booked" ? (vendor.agreed_cents ?? 0) : 0;
  return {
    committed,
    paid,
    scheduled,
    remaining: committed - paid,
    unscheduled: committed - paid - scheduled,
  };
}
export function budgetTotals(
  state: FinanceState,
  budgetCents: number | null,
  today = localDateKey(),
) {
  const committed = state.vendors.reduce(
    (sum, v) => sum + vendorTotals(v, state.payments).committed,
    0,
  );
  const paid = state.payments
    .filter((p) => !!p.paid_date)
    .reduce((n, p) => n + p.amount_cents, 0);
  const scheduled = state.payments
    .filter((p) => !p.paid_date)
    .reduce((n, p) => n + p.amount_cents, 0);
  return {
    committed,
    paid,
    scheduled,
    remaining: committed - paid,
    available: budgetCents === null ? null : budgetCents - committed,
    overdue: state.payments.filter(
      (p) => !p.paid_date && !!p.due_date && p.due_date < today,
    ).length,
  };
}
function same(a: object, b: object) {
  return Object.entries(b).every(
    ([k, v]) => (a as Record<string, unknown>)[k] === v,
  );
}
function currentVendor(state: FinanceState, id: string, expected: number) {
  const vendor = state.vendors.find((v) => v.id === id);
  if (!vendor || vendor.version !== expected) throw Error(financeConflict);
  return vendor;
}
export function saveVendorState(
  state: FinanceState,
  id: string,
  weddingId: string,
  expected: number | null,
  input: VendorDraft,
): FinanceState {
  const valid = validateVendor(input);
  const existing = state.vendors.find((v) => v.id === id);
  if (expected === null) {
    if (existing) {
      if (existing.wedding_id === weddingId && same(existing, valid))
        return state;
      throw Error(financeConflict);
    }
    return {
      ...state,
      vendors: [
        ...state.vendors,
        { ...valid, id, wedding_id: weddingId, version: 1 },
      ],
    };
  }
  const original = currentVendor(state, id, expected);
  const total = state.payments
    .filter((p) => p.vendor_id === id)
    .reduce((n, p) => n + p.amount_cents, 0);
  if (
    state.payments.some((p) => p.vendor_id === id) &&
    (valid.status !== "booked" || valid.agreed_cents! < total)
  )
    throw Error(
      "לא ניתן להפחית את המחיר או לבטל סגירה כל עוד קיימים רישומי תשלום שאינם מתאימים לשינוי.",
    );
  return {
    ...state,
    vendors: state.vendors.map((v) =>
      v.id === id
        ? { ...original, ...valid, version: original.version + 1 }
        : v,
    ),
  };
}
export function deleteVendorState(
  state: FinanceState,
  vendor: Vendor,
): FinanceState {
  currentVendor(state, vendor.id, vendor.version);
  if (state.payments.some((p) => p.vendor_id === vendor.id))
    throw Error("לספק יש רישומי תשלום. יש לטפל בהם לפני מחיקת הכרטיס.");
  return { ...state, vendors: state.vendors.filter((v) => v.id !== vendor.id) };
}
export function savePaymentState(
  state: FinanceState,
  vendor: Vendor,
  id: string,
  expected: number | null,
  input: PaymentDraft,
): FinanceState {
  const valid = validatePayment(input);
  const existing = state.payments.find((p) => p.id === id);
  if (expected === null && existing) {
    if (existing.vendor_id === vendor.id && same(existing, valid)) return state;
    throw Error(financeConflict);
  }
  const parent = currentVendor(state, vendor.id, vendor.version);
  if (parent.status !== "booked")
    throw Error("אפשר לרשום תשלומים רק לספק שנסגר עם מחיר מוסכם.");
  if (
    expected !== null &&
    (!existing ||
      existing.version !== expected ||
      existing.vendor_id !== vendor.id)
  )
    throw Error(financeConflict);
  const allocated = state.payments
    .filter((p) => p.vendor_id === vendor.id && p.id !== id)
    .reduce((n, p) => n + p.amount_cents, 0);
  if (allocated + valid.amount_cents > parent.agreed_cents!)
    throw Error("סך התשלומים ששולמו ומתוכננים גבוה מהמחיר שסוכם.");
  const payment = {
    ...valid,
    id,
    vendor_id: vendor.id,
    wedding_id: vendor.wedding_id,
    version: existing ? existing.version + 1 : 1,
  };
  return {
    vendors: state.vendors.map((v) =>
      v.id === parent.id ? { ...v, version: v.version + 1 } : v,
    ),
    payments: existing
      ? state.payments.map((p) => (p.id === id ? payment : p))
      : [...state.payments, payment],
  };
}
export function deletePaymentState(
  state: FinanceState,
  vendor: Vendor,
  payment: Payment,
): FinanceState {
  currentVendor(state, vendor.id, vendor.version);
  const current = state.payments.find((p) => p.id === payment.id);
  if (
    !current ||
    current.version !== payment.version ||
    current.vendor_id !== vendor.id
  )
    throw Error(financeConflict);
  return {
    vendors: state.vendors.map((v) =>
      v.id === vendor.id ? { ...v, version: v.version + 1 } : v,
    ),
    payments: state.payments.filter((p) => p.id !== payment.id),
  };
}
