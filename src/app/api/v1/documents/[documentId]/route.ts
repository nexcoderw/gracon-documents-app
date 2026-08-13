/** Same-origin document resource endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Returns one authorized document and rewrites private editor assets. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: (params) => `/documents/${getPathParam(params, "documentId")}`,
  authentication: "access",
  allowedQueryParams: ["includeContent"],
  maxResponseBytes: 20 * 1024 * 1024,
  rewriteDocumentAssets: true,
});

/** Updates editable document metadata. */
export const PATCH = createBackendRoute({
  service: "documents",
  upstreamPath: (params) => `/documents/${getPathParam(params, "documentId")}`,
  authentication: "access",
  body: "json",
  rewriteDocumentAssets: true,
});

/** Soft-deletes an authorized document. */
export const DELETE = createBackendRoute({
  service: "documents",
  upstreamPath: (params) => `/documents/${getPathParam(params, "documentId")}`,
  authentication: "access",
});
