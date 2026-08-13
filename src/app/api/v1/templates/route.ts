/** Same-origin document template collection endpoint. */
import { createBackendRoute } from "@/lib/server/backend-proxy";

/** Lists templates using explicitly allowed filters. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: "/templates",
  authentication: "access",
  allowedQueryParams: ["category", "type"],
  rewriteDocumentAssets: true,
});
