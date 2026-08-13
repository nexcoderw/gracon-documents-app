/** Same-origin public document verification endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Returns bounded public verification evidence for a locked document. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/verify`,
  authentication: "none",
});
