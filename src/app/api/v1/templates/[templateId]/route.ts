/** Same-origin document template detail endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Returns one authorized template with same-origin editor assets. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: (params) => `/templates/${getPathParam(params, "templateId")}`,
  authentication: "access",
  rewriteDocumentAssets: true,
});
