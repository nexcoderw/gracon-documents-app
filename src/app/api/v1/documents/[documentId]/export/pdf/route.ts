/** Same-origin signed PDF download endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Streams one authorized PDF with bounded response size. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/export/pdf`,
  authentication: "access",
  response: "binary",
  maxResponseBytes: 40 * 1024 * 1024,
  timeoutMs: 60_000,
});
