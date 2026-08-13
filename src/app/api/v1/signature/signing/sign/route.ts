/**
 * Same-origin signing proxy for app/documents.
 *
 * The browser sends the frozen document hash here; this route resolves or
 * upgrades the shared session before forwarding the request to api/signature.
 */
import { createBackendRoute } from "@/lib/server/backend-proxy";

/** Signs a frozen hash through a bounded same-origin mutation. */
export const POST = createBackendRoute({
  service: "signature",
  upstreamPath: "/signature/signing/sign",
  authentication: "access",
  body: "json",
  maxRequestBytes: 128 * 1024,
});
