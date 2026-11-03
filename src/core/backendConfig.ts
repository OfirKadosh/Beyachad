type BackendInput = { url?: string; publishableKey?: string; anonKey?: string };
export function resolveBackendConfig(input: BackendInput) {
  const url = (input.url ?? "").trim();
  const publishableKey = (input.publishableKey ?? "").trim();
  const key = publishableKey || (input.anonKey ?? "").trim();
  const problems: string[] = [];
  if (!url) problems.push("חסר EXPO_PUBLIC_SUPABASE_URL.");
  else {
    try {
      const parsed = new URL(url);
      if (
        parsed.protocol !== "https:" ||
        !parsed.hostname ||
        parsed.username ||
        parsed.password ||
        parsed.search ||
        parsed.hash ||
        parsed.pathname !== "/"
      )
        throw Error();
    } catch {
      problems.push(
        "EXPO_PUBLIC_SUPABASE_URL חייב להיות כתובת HTTPS מלאה של הפרויקט, ללא נתיב נוסף.",
      );
    }
  }
  if (!key)
    problems.push(
      "חסר EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY או EXPO_PUBLIC_SUPABASE_ANON_KEY.",
    );
  else if (key.startsWith("sb_secret_"))
    problems.push("יש להשתמש במפתח ציבורי, ולא במפתח שרת סודי.");
  return {
    url: url.replace(/\/$/, ""),
    key,
    configured: problems.length === 0,
    problems,
  };
}
