/**
 * Proxies user preference reads from the documents app to api/auth.
 *
 * The browser keeps talking to the documents origin while the route handler
 * forwards the authenticated request to the user-owned preferences endpoint.
 */
import { createBackendRoute } from "@/lib/server/backend-proxy";

/**
 * Reads the current user's cross-platform invitation defaults.
 */
export const GET = createBackendRoute({
  service: "auth",
  upstreamPath: "/users/preferences",
  authentication: "access",
});
