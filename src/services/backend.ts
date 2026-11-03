import "react-native-url-polyfill/auto";
import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { sessionStorage, type KV } from "../core/chunkStorage";
import { backendConfigured, backendKey, backendUrl } from "./config";
const memory = new Map<string, string>();
// Browser preview deliberately keeps tokens in memory only, never localStorage.
const storage: KV =
  Platform.OS === "web"
    ? {
        getItem: async (k) => memory.get(k) ?? null,
        setItem: async (k, v) => {
          memory.set(k, v);
        },
        removeItem: async (k) => {
          memory.delete(k);
        },
      }
    : sessionStorage({
        getItem: (k) => SecureStore.getItemAsync(k),
        setItem: (k, v) =>
          SecureStore.setItemAsync(k, v, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          }),
        removeItem: (k) => SecureStore.deleteItemAsync(k),
      });
export const backend = backendConfigured
  ? createClient(backendUrl, backendKey, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    })
  : null;
export function requireBackend() {
  if (!backend) throw Error("יש לחבר את שירות החשבונות לפי הוראות ההתקנה.");
  return backend;
}
