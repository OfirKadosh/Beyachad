import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { pathToFileURL } from "node:url";
import { resolveBackendConfig } from "../src/core/backendConfig.ts";
/** @param {string} directory
 * @param {Record<string,string|undefined>} environment
 * @param {string} mode */
export function inspectConfig(
  directory = process.cwd(),
  environment = process.env,
  mode = "development",
) {
  const names = [`.env.${mode}.local`, ".env.local", `.env.${mode}`, ".env"];
  const values = { ...environment },
    loaded = [];
  // Match Expo's resolution order; process environment has highest priority.
  for (const name of environment.EXPO_NO_DOTENV === "1" ? [] : names) {
    const path = resolve(directory, name);
    if (!existsSync(path)) continue;
    loaded.push(name);
    const parsed = parseEnv(readFileSync(path, "utf8"));
    for (const [key, value] of Object.entries(parsed))
      if (values[key] === undefined) values[key] = value;
  }
  const config = resolveBackendConfig({
    url: values.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: values.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    anonKey: values.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
  const hints = [];
  if (!config.configured && existsSync(resolve(directory, ".env.txt")))
    hints.push("נמצא .env.txt. שם הקובץ צריך להיות .env, ללא סיומת txt.");
  if (values.EXPO_NO_DOTENV === "1")
    hints.push("EXPO_NO_DOTENV=1 מונע מ־Expo לטעון קובצי env.");
  if (values.EXPO_NO_CLIENT_ENV_VARS === "1")
    hints.push(
      "EXPO_NO_CLIENT_ENV_VARS=1 מונע מ־Expo להטמיע משתנים באפליקציה.",
    );
  if (
    !config.configured &&
    Object.keys(values).some(
      (k) => /SUPABASE/.test(k) && !k.startsWith("EXPO_PUBLIC_"),
    )
  )
    hints.push(
      "נמצאו משתני Supabase ללא הקידומת EXPO_PUBLIC_. האפליקציה דורשת את שמות המשתנים שב־.env.example.",
    );
  return {
    configured: config.configured && values.EXPO_NO_CLIENT_ENV_VARS !== "1",
    loaded,
    problems: config.problems,
    hints,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const report = inspectConfig(
    process.cwd(),
    process.env,
    process.argv.includes("--production") ? "production" : "development",
  );
  console.log(`Env files: ${report.loaded.join(", ") || "none"}`);
  for (const problem of [...report.problems, ...report.hints])
    console.log(problem);
  console.log(
    report.configured
      ? "Supabase configuration: OK (values hidden)."
      : "Supabase configuration: NOT READY.",
  );
  process.exitCode = report.configured ? 0 : 1;
}
