/** Same-origin document copy endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Creates an authorized draft copy. */
export const POST = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/copy`,
  authentication: "access",
  rewriteDocumentAssets: true,
});
