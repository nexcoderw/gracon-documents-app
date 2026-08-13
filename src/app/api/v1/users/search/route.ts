/** Same-origin collaborator search endpoint. */
import { createBackendRoute } from "@/lib/server/backend-proxy";

/** Searches users with only the approved query fields. */
export const GET = createBackendRoute({
  service: "documents",
  upstreamPath: "/users/search",
  authentication: "access",
  allowedQueryParams: ["q", "mode"],
});
