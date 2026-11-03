import { canUseDevSession } from "../core/domain";
export const devSession = canUseDevSession(
  __DEV__,
  process.env.EXPO_PUBLIC_APP_ENV,
  process.env.EXPO_PUBLIC_DEV_SESSION,
);
export const backendUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const backendKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const backendConfigured =
  /^https:\/\//.test(backendUrl) && backendKey.length > 0;
