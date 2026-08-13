/** Same-origin collaborator access endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Updates a collaborator permission set. */
export const PATCH = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/access/${getPathParam(params, "collaboratorId")}`,
  authentication: "access",
  body: "json",
});

/** Revokes a collaborator or pending invitation. */
export const DELETE = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/access/${getPathParam(params, "collaboratorId")}`,
  authentication: "access",
});
