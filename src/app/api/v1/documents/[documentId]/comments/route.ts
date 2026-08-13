/** Same-origin document comments endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Lists cursor-paginated comment threads. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/comments`,
  authentication: "access",
  allowedQueryParams: ["limit", "cursor"],
});

/** Creates a bounded comment or reply. */
export const POST = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/comments`,
  authentication: "access",
  body: "json",
});
