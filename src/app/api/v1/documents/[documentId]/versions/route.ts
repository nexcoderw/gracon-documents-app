/** Same-origin document version-history endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Lists bounded version metadata for one document. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/versions`,
  authentication: "access",
});
