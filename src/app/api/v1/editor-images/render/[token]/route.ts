/** Same-origin private editor image renderer. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Streams image bytes selected by a tamper-proof backend token. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/editor-images/render/${getPathParam(params, "token")}`,
  authentication: "none",
  response: "binary",
  maxResponseBytes: 8 * 1024 * 1024,
});
