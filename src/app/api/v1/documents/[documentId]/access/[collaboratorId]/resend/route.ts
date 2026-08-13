/** Same-origin invitation resend endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Resends a pending invitation using backend anti-replay policy. */
export const POST = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/access/${getPathParam(params, "collaboratorId")}/resend`,
  authentication: "access",
});
