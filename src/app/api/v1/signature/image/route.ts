/**
 * Same-origin proxy for the signature service current-signature-image endpoint.
 *
 * app/documents must not depend on direct cross-origin browser calls to
 * api/signature. This route forwards the shared session token and returns the
 * presigned URL payload used by inline document signature blocks.
 */
import { createBackendRoute } from "@/lib/server/backend-proxy";

/** Returns current signature-image metadata through server-owned auth. */
export const GET = createBackendRoute({
  service: "signature",
  upstreamPath: "/signature/image",
  authentication: "access",
});
