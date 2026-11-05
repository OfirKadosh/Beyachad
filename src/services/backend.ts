import "react-native-url-polyfill/auto";
import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { sessionStorage, type KV } from "../core/chunkStorage";
import { browserSessionStorage } from "../core/browserStorage";
import { backendConfigured, backendKey, backendUrl } from "./config";
const storage: KV =
  Platform.OS === "web"
    ? browserSessionStorage(() =>
        typeof window === "undefined" ? null : window.localStorage,
      )
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
        ...(Platform.OS === "web" ? {} : { lock: processLock }),
      },
    })
  : null;
export function requireBackend() {
  if (!backend) throw Error("יש לחבר את שירות החשבונות לפי הוראות ההתקנה.");
  return backend;
}
