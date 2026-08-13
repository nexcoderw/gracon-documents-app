/** Same-origin document folder collection endpoint. */
import { createBackendRoute } from "@/lib/server/backend-proxy";

/** Lists the current user's folder tree. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: "/folders",
  authentication: "access",
});

/** Creates a folder through the authorized documents service. */
export const POST = createBackendRoute({
  service: "documents",
  upstreamPath: "/folders",
  authentication: "access",
  body: "json",
});
