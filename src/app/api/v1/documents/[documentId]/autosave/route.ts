/** Same-origin document autosave endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Persists bounded TipTap JSON for an editable document. */
export const PATCH = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/${getPathParam(params, "documentId")}/autosave`,
  authentication: "access",
  body: "json",
  maxRequestBytes: 10 * 1024 * 1024,
});
