/** Same-origin document access-audit endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Lists sanitized access events using bounded query forwarding. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/access/audit`,
  authentication: "access",
  allowedQueryParams: ["limit"],
});
