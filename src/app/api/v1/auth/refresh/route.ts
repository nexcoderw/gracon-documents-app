/** Same-origin refresh endpoint using the server-owned cookie. */
import { createBackendRoute } from "@/lib/server/backend-proxy";

/** Rotates the refresh session without trusting a browser token body. */
export const POST = createBackendRoute({
  service: "auth",
  upstreamPath: "/auth/refresh",
  body: "json",
  maxRequestBytes: 16 * 1024,
  injectRefreshToken: true,
  sessionResponse: true,
});
