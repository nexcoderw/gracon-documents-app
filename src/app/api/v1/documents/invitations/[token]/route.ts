/** Same-origin public invitation preview endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Returns only backend-approved pre-authentication invitation metadata. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/invitations/${getPathParam(params, "token")}`,
  authentication: "none",
});
