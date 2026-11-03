// Minimal ambient host surface used to typecheck our handler in CI.
// Supabase deploys this code in Deno; runtime behavior is separately exercised with request mocks.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
