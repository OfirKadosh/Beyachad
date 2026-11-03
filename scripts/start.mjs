import { spawn } from "node:child_process";
const args = process.argv.slice(2);
const auth = args.includes("--auth");
const release = args.includes("--release");
const extra = args.filter((a) => a !== "--auth" && a !== "--release");
const child = spawn(
  process.execPath,
  [
    "node_modules/expo/bin/cli",
    ...(release ? ["export", "--platform", "web"] : ["start"]),
    ...extra,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PUBLIC_APP_ENV: release ? "production" : "development",
      EXPO_PUBLIC_DEV_SESSION: auth || release ? "false" : "true",
    },
  },
);
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
