/** Same-origin invitation acceptance endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Accepts an invitation only after backend proof checks. */
export const POST = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/invitations/${getPathParam(params, "token")}/accept`,
  authentication: "access",
});
