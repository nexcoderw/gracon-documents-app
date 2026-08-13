/** Same-origin document finalisation endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Freezes a document through an origin-checked request. */
export const POST = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/finalise`,
  authentication: "access",
  body: "json",
  rewriteDocumentAssets: true,
});
