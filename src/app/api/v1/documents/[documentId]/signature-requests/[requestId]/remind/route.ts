/** Same-origin signature reminder endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Sends a backend-authorized reminder for one pending signer. */
export const POST = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/signature-requests/${getPathParam(params, "requestId")}/remind`,
  authentication: "access",
});
