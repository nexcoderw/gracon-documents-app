/** Same-origin invitation decline endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Declines an invitation for the authenticated recipient. */
export const POST = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/invitations/${getPathParam(params, "token")}/decline`,
  authentication: "access",
});
