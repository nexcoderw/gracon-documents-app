/** Same-origin invitation OTP request endpoint. */
import { createBackendRoute, getPathParam } from "@/lib/server/backend-proxy";

/** Requests a rate-limited invitation OTP with optional session context. */
export const POST = createBackendRoute({
  service: "documents",
  upstreamPath: (params) =>
    `/documents/invitations/${getPathParam(params, "token")}/email-otp/request`,
  authentication: "optional",
  body: "json",
});
