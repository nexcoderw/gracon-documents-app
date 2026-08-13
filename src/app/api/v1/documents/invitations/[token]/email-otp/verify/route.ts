/** Same-origin invitation OTP verification endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Verifies one transient invitation OTP. */
export const POST = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/invitations/${getPathParam(params, "token")}/email-otp/verify`,
  authentication: "optional",
  body: "json",
});
