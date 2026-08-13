/** Same-origin invitation proof-gate endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Resolves the next gate using optional authenticated context. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/invitations/${getPathParam(params, "token")}/gate`,
  authentication: "optional",
});
