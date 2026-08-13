/** Same-origin document collection endpoint. */
import { createBackendRoute } from "@/lib/server/backend-proxy";

/** Lists documents through bounded filters. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: "/documents",
  authentication: "access",
  allowedQueryParams: [
    "scope",
    "status",
    "type",
    "folderId",
    "search",
    "page",
    "limit",
  ],
  rewriteDocumentAssets: true,
});

/** Creates a document through the authorized documents service. */
export const POST = createBackendRoute({
  service: "documents",
  upstreamPath: "/documents",
  authentication: "access",
  body: "json",
  rewriteDocumentAssets: true,
});
