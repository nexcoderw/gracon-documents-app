/** Same-origin document version restoration endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Restores one validated version through the backend. */
export const POST = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/versions/${getPathParam(params, "versionNumber")}/restore`,
  authentication: "access",
});
