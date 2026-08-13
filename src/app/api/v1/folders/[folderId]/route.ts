/** Same-origin folder deletion endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Deletes an authorized folder without deleting contained documents. */
export const DELETE = createBackendRoute({
  service: "documents",
  upstreamPath: (params) => `/folders/${getPathParam(params, "folderId")}`,
  authentication: "access",
});
