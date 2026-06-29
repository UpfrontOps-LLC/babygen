// Cloudflare binding types for the Next app's typecheck.
//
// IMPORTANT: we deliberately do NOT load @cloudflare/workers-types globally here.
// That package is ambient-global-only and would clobber lib.dom's Request/
// Response/fetch (`.json()` becomes `unknown`), breaking existing client + server
// code. So the Next app sees these minimal structural binding shapes instead; the
// Worker + Workflow get the real workers-types via tsconfig.worker.json.
interface MinimalKV {
  get(key: string, type: "json"): Promise<unknown>;
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}
interface MinimalWorkflow {
  create(options?: { id?: string; params?: unknown }): Promise<unknown>;
  get(id: string): Promise<unknown>;
}

declare global {
  // Merges with OpenNext's own CloudflareEnv (ASSETS, cache bindings, …).
  interface CloudflareEnv {
    SESSIONS: MinimalKV;
    META: MinimalKV;
    GENERATE_BABY: MinimalWorkflow;

    // String vars / secrets. OpenNext copies these into process.env on the
    // request path; the Workflow reads them off `this.env`.
    REPLICATE_API_TOKEN?: string;
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    REAL_GEN?: string;
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
    NEXT_PUBLIC_BASE_URL?: string;
    PRICE_CENTS?: string;
  }
}

export {};
