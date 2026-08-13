/**
 * Server-only ownership of backend service origins used by app/documents.
 */

import "server-only";
import { validateServiceBase } from "./backend-proxy-policy";

export type DocumentsBackendService = "auth" | "documents" | "signature";

const DEFAULT_SERVICE_BASES: Record<DocumentsBackendService, string> = {
  auth: "http://localhost:3000/api/v1",
  documents: "http://localhost:3005/api/v1",
  signature: "http://localhost:3002/api/v1",
};

const SERVICE_ENV_KEYS: Record<DocumentsBackendService, string> = {
  auth: "AUTH_API_URL",
  documents: "DOCUMENTS_API_URL",
  signature: "SIGNATURE_API_URL",
};

/**
 * Resolves and validates one server-only backend base URL.
 *
 * @param service Backend trust boundary.
 * @returns Normalized service base URL without a trailing slash.
 */
export function getServiceBase(service: DocumentsBackendService): string {
  const value =
    process.env[SERVICE_ENV_KEYS[service]] ?? DEFAULT_SERVICE_BASES[service];
  const parsed = validateServiceBase(
    value,
    process.env.NODE_ENV === "production",
  );
  return parsed.toString().replace(/\/$/, "");
}
