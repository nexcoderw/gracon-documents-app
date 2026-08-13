/**
 * Same-origin proxy for the signature service current-certificate endpoint.
 *
 * The browser must not call api/signature directly from app/documents because
 * deployment origins differ. This route forwards the shared session token,
 * refreshes it when needed, and preserves the upstream certificate status.
 */
import { createBackendRoute } from "@/lib/server/backend-proxy";

/** Returns the current user's certificate status through server-owned auth. */
export const GET = createBackendRoute({
  service: "signature",
  upstreamPath: "/signature/certificates/current",
  authentication: "access",
});
