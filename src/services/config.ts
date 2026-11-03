import { canUseDevSession } from "../core/domain";
import { resolveBackendConfig } from "../core/backendConfig";
export const devSession = canUseDevSession(
  __DEV__,
  process.env.EXPO_PUBLIC_APP_ENV,
  process.env.EXPO_PUBLIC_DEV_SESSION,
);
// Keep each reference static: Expo only inlines EXPO_PUBLIC_ variables in dot notation.
const config = resolveBackendConfig({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});
export const backendUrl = config.url;
export const backendKey = config.key;
export const backendConfigured = config.configured;
export const backendConfigMessage = config.problems.join(" ");
