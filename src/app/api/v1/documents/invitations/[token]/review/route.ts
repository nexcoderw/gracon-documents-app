/** Same-origin authenticated invitation review endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Reveals invitation review data only to the authorized recipient. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/invitations/${getPathParam(params, "token")}/review`,
  authentication: "access",
});
