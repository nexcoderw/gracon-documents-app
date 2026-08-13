/** Same-origin editor image upload endpoint. */
import { createBackendRoute } from "@/lib/server/backend-proxy";

/** Uploads one bounded editor image and returns a same-origin render URL. */
export const POST = createBackendRoute({
  service: "documents",
  upstreamPath: "/editor-images/upload",
  authentication: "access",
  body: "multipart",
  maxRequestBytes: 8 * 1024 * 1024 + 256 * 1024,
  timeoutMs: 60_000,
  rewriteDocumentAssets: true,
});
