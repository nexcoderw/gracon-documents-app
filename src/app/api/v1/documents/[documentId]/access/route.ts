/** Same-origin document access-management endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Lists collaborators and pending invitations. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/access`,
  authentication: "access",
});

/** Creates or refreshes an invitation with explicit permissions. */
export const POST = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/access`,
  authentication: "access",
  body: "json",
});
