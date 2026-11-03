import type { GuestInvitation } from "../core/guests";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Wedding, Task } from "../core/domain";
import type { FinanceState } from "../core/finance";
export const WORKSPACE_KEY = "beyachad.development.v1";
export type LocalWorkspace = FinanceState & {
  wedding: Wedding | null;
  tasks: Task[];
  guests: GuestInvitation[];
};
const empty = (): LocalWorkspace => ({
  wedding: null,
  tasks: [],
  vendors: [],
  payments: [],
  guests: [],
});
let queue: Promise<unknown> = Promise.resolve();
export async function readWorkspace(): Promise<LocalWorkspace> {
  const raw = await AsyncStorage.getItem(WORKSPACE_KEY);
  return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
}
// A single write queue spans task, budget and vendor providers on this device.
export function mutateWorkspace(
  fn: (current: LocalWorkspace) => LocalWorkspace | Promise<LocalWorkspace>,
): Promise<LocalWorkspace> {
  const operation = queue.then(async () => {
    const next = await fn(await readWorkspace());
    await AsyncStorage.setItem(WORKSPACE_KEY, JSON.stringify(next));
    return next;
  });
  queue = operation.catch(() => {});
  return operation;
}
