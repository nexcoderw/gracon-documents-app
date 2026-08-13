/** Same-origin development-compatible login endpoint. */
import { createBackendRoute } from "@/lib/server/backend-proxy";

/** Authenticates through api/auth and establishes server-owned cookies. */
export const POST = createBackendRoute({
  service: "auth",
  upstreamPath: "/auth/login",
  body: "json",
  maxRequestBytes: 64 * 1024,
  sessionResponse: true,
});
