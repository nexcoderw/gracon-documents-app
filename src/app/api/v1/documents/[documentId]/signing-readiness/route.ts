/** Same-origin document signing-readiness endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Resolves the next signing step with optional session context. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/signing-readiness`,
  authentication: "optional",
});
