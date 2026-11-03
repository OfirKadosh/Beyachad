import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as validation from "../src/core/documents";
function server({
  member = true,
  registerFails = false,
  removeFails = false,
} = {}) {
  let handler: (req: Request) => Promise<Response>;
  const calls: string[] = [];
  const chain = (table: string) => ({
    select() {
      return this;
    },
    eq() {
      return this;
    },
    async maybeSingle() {
      return {
        data:
          table === "wedding_members"
            ? member
              ? { user_id: "user" }
              : null
            : { id: "doc" },
        error: null,
      };
    },
    delete() {
      calls.push("delete-metadata");
      return this;
    },
    then(resolve: (value: unknown) => void) {
      return Promise.resolve({ error: null }).then(resolve);
    },
  });
  const service = {
    auth: {
      async getUser(token: string) {
        return {
          data: { user: token === "valid" ? { id: "user" } : null },
          error: null,
        };
      },
    },
    from: chain,
    storage: {
      from: () => ({
        async upload() {
          calls.push("upload");
          return { error: null };
        },
        async remove() {
          calls.push("remove");
          return { error: removeFails ? Error("failed") : null };
        },
      }),
    },
    async rpc() {
      calls.push("register");
      return { error: registerFails ? Error("failed") : null };
    },
  };
  const source = ts.transpileModule(
    readFileSync("supabase/functions/documents/index.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(source, {
    exports: {},
    require: (name: string) =>
      name.startsWith("npm:") ? { createClient: () => service } : validation,
    Deno: {
      env: { get: () => "server-only" },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
    Response,
    TextDecoder,
    Uint8Array,
    console: { error: () => {} },
  });
  return {
    calls,
    request: (
      body: object,
      token = "valid",
      extra: Record<string, string> = {},
    ) =>
      handler(
        new Request("https://test/documents", {
          method: "POST",
          headers: { Authorization: "Bearer " + token, ...extra },
          body: JSON.stringify(body),
        }),
      ),
  };
}
const payload = {
  action: "upload",
  weddingId: "10000000-0000-4000-8000-000000000001",
  id: "10000000-0000-4000-8000-000000000002",
  name: "contract.pdf",
  mime: "application/pdf",
  base64: btoa("%PDF-1.7\nhello"),
};
test("document server rejects invalid auth, strangers, identifiers and oversized bodies before storage", async () => {
  const auth = server();
  assert.equal((await auth.request(payload, "bad")).status, 401);
  assert.deepEqual(auth.calls, []);
  const stranger = server({ member: false });
  assert.equal((await stranger.request(payload)).status, 403);
  assert.deepEqual(stranger.calls, []);
  assert.equal(
    (await auth.request({ ...payload, id: "../escape" })).status,
    400,
  );
  assert.equal(
    (await auth.request(payload, "valid", { "content-length": "8000000" }))
      .status,
    413,
  );
  assert.deepEqual(auth.calls, []);
});
test("document server validates bytes, registers service uploads and cleans up failed registration", async () => {
  const normal = server();
  assert.equal(
    (await normal.request({ ...payload, base64: btoa("<script>") })).status,
    400,
  );
  assert.deepEqual(normal.calls, []);
  assert.equal((await normal.request(payload)).status, 200);
  assert.deepEqual(normal.calls, ["upload", "register"]);
  const failed = server({ registerFails: true });
  assert.equal((await failed.request(payload)).status, 409);
  assert.deepEqual(failed.calls, ["upload", "register", "remove"]);
});
test("document removal keeps metadata when Storage deletion fails, allowing retry", async () => {
  const failed = server({ removeFails: true });
  assert.equal(
    (await failed.request({ ...payload, action: "remove" })).status,
    500,
  );
  assert.deepEqual(failed.calls, ["remove"]);
  const normal = server();
  assert.equal(
    (await normal.request({ ...payload, action: "remove" })).status,
    200,
  );
  assert.deepEqual(normal.calls, ["remove", "delete-metadata"]);
});
