/** Same-origin signature placement endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Updates the locked signature-strip placement. */
export const PATCH = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/signature-layout`,
  authentication: "access",
  body: "json",
  rewriteDocumentAssets: true,
});
