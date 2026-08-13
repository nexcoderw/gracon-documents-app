/** Same-origin comment resolution endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Resolves one top-level comment through owner authorization. */
export const PATCH = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/comments/${getPathParam(params, "commentId")}/resolve`,
  authentication: "access",
});
