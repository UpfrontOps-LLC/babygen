// OpenNext (Cloudflare) config for babygen / seeourbaby.com.
//
// No incremental cache is configured: the app has no ISR / `revalidate` — the
// marketing pages are statically generated at build (served from assets) and
// every API route is `force-dynamic`. So we skip R2/KV incremental cache (and
// the self-reference + R2 bucket bindings the default template adds for it).
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
