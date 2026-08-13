/** Same-origin folder rename endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Renames an authorized folder. */
export const PATCH = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/folders/${getPathParam(params, "folderId")}/rename`,
  authentication: "access",
  body: "json",
});
