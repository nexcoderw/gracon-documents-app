/** Same-origin owner-lock endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Permanently locks a fully signed document. */
export const POST = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/lock`,
  authentication: "access",
  rewriteDocumentAssets: true,
});
