import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveBackendConfig } from "../src/core/backendConfig";
import { inspectConfig } from "../scripts/check-config.mjs";
const url = "https://project.supabase.co",
  key = "sb_publishable_test";
test("auth configuration requires a real HTTPS base URL and a nonempty public key", () => {
  for (const candidate of [
    undefined,
    "",
    "https://",
    "http://project.supabase.co",
    url + "/auth/v1",
    "https://user:pass@project.supabase.co",
  ])
    assert.equal(
      resolveBackendConfig({ url: candidate, publishableKey: key }).configured,
      false,
    );
  assert.equal(
    resolveBackendConfig({ url, publishableKey: "" }).configured,
    false,
  );
  assert.equal(
    resolveBackendConfig({ url, publishableKey: "sb_secret_server" })
      .configured,
    false,
  );
});
test("publishable/legacy anon names and whitespace produce the same usable configuration", () => {
  assert.deepEqual(
    resolveBackendConfig({
      url: " " + url + "/ ",
      publishableKey: " " + key + " ",
    }),
    { url, key, configured: true, problems: [] },
  );
  assert.equal(
    resolveBackendConfig({ url, anonKey: "legacy-anon" }).key,
    "legacy-anon",
  );
  assert.equal(
    resolveBackendConfig({ url, publishableKey: " ", anonKey: "legacy-anon" })
      .configured,
    true,
  );
  assert.equal(
    resolveBackendConfig({ url, publishableKey: key, anonKey: "other" }).key,
    key,
  );
});
test("safe diagnostic follows Expo env precedence and never returns credential values", () => {
  const directory = mkdtempSync(join(tmpdir(), "beyachad-env-"));
  try {
    writeFileSync(
      join(directory, ".env"),
      `EXPO_PUBLIC_SUPABASE_URL=${url}\nEXPO_PUBLIC_SUPABASE_ANON_KEY=legacy-secret-value`,
    );
    writeFileSync(
      join(directory, ".env.local"),
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-secret-value",
    );
    const report = inspectConfig(directory, {});
    assert.equal(report.configured, true);
    assert.deepEqual(report.loaded, [".env.local", ".env"]);
    assert.ok(!JSON.stringify(report).includes("secret-value"));
    assert.equal(
      inspectConfig(directory, { EXPO_PUBLIC_SUPABASE_URL: "bad" }).configured,
      false,
    );
    assert.equal(
      inspectConfig(directory, { EXPO_NO_DOTENV: "1" }).configured,
      false,
    );
    writeFileSync(join(directory, ".env.txt"), "irrelevant");
    assert.match(
      inspectConfig(directory, { EXPO_PUBLIC_SUPABASE_URL: "bad" }).hints.join(
        " ",
      ),
      /\.env.txt/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
