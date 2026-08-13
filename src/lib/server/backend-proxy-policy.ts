/**
 * Pure validation helpers for fixed same-origin documents BFF routes.
 */

const SAFE_UPSTREAM_PROTOCOLS = new Set(["http:", "https:"]);
const EDITOR_IMAGE_PATH = "/api/v1/editor-images/render/";

/**
 * Encodes one dynamic route value after rejecting path-control input.
 *
 * @param value Decoded route parameter.
 * @returns A safe upstream path segment.
 */
export function encodePathSegment(value: string | undefined): string {
  if (
    !value ||
    value.length > 1_024 ||
    value === "." ||
    value === ".." ||
    /[\/\\\0]/.test(value)
  ) {
    throw new Error("Unsafe route parameter");
  }

  return encodeURIComponent(value);
}

/**
 * Reads one scalar Next.js route parameter as an encoded segment.
 *
 * @param params Dynamic route parameter collection.
 * @param key Parameter name.
 * @returns A safe encoded segment.
 */
export function getPathParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = params[key];
  return encodePathSegment(typeof value === "string" ? value : undefined);
}

/**
 * Validates a configured service base URL.
 *
 * @param value Configured server-only base URL.
 * @param requireHttps Whether production TLS is required.
 * @returns A normalized trusted base URL.
 */
export function validateServiceBase(value: string, requireHttps: boolean): URL {
  const normalized = value.endsWith("/") ? value : `${value}/`;
  const parsed = new URL(normalized);
  if (!SAFE_UPSTREAM_PROTOCOLS.has(parsed.protocol)) {
    throw new Error("Unsupported upstream protocol");
  }
  if (requireHttps && parsed.protocol !== "https:") {
    throw new Error("Production upstreams must use HTTPS");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("Upstream base URL contains forbidden components");
  }
  return parsed;
}

/**
 * Builds a fixed-origin upstream URL with only allowlisted query parameters.
 *
 * @param baseUrl Server-configured service base URL.
 * @param upstreamPath Code-owned service path.
 * @param requestUrl Incoming frontend request URL.
 * @param allowedQueryParams Query keys approved for the operation.
 * @param requireHttps Whether the upstream must use TLS.
 * @returns A validated service URL.
 */
export function buildBackendUrl(
  baseUrl: string,
  upstreamPath: string,
  requestUrl: URL,
  allowedQueryParams: readonly string[],
  requireHttps: boolean,
): URL {
  if (
    !upstreamPath.startsWith("/") ||
    upstreamPath.includes("..") ||
    upstreamPath.includes("?") ||
    upstreamPath.includes("#") ||
    upstreamPath.includes("://")
  ) {
    throw new Error("Unsafe upstream path");
  }

  const expectedBase = validateServiceBase(baseUrl, requireHttps);
  const target = new URL(upstreamPath.slice(1), expectedBase);
  if (target.origin !== expectedBase.origin) {
    throw new Error("Upstream path escaped its configured origin");
  }

  for (const key of allowedQueryParams) {
    for (const value of requestUrl.searchParams.getAll(key)) {
      if (value.length > 2_048) {
        throw new Error("Query value exceeds the proxy limit");
      }
      target.searchParams.append(key, value);
    }
  }
  return target;
}

/**
 * Checks browser evidence for a same-origin state-changing request.
 *
 * @param requestUrl Incoming frontend URL.
 * @param originHeader Browser Origin header.
 * @param fetchSite Browser Sec-Fetch-Site header.
 * @returns Whether the request is same-origin.
 */
export function isSameOriginMutation(
  requestUrl: URL,
  originHeader: string | null,
  fetchSite: string | null,
): boolean {
  if (fetchSite === "cross-site" || fetchSite === "same-site") return false;
  if (!originHeader) return fetchSite === "same-origin";

  try {
    return new URL(originHeader).origin === requestUrl.origin;
  } catch {
    return false;
  }
}

/**
 * Recursively removes refresh credentials from session responses.
 *
 * @param payload Parsed response payload.
 * @returns A cloned browser-safe payload.
 */
export function redactRefreshTokens(payload: unknown): unknown {
  if (Array.isArray(payload)) return payload.map(redactRefreshTokens);
  if (!payload || typeof payload !== "object") return payload;

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      key === "refreshToken" ? "" : redactRefreshTokens(value),
    ]),
  );
}

function rewriteEditorImageString(value: string): string {
  try {
    const parsed = new URL(value);
    const index = parsed.pathname.indexOf(EDITOR_IMAGE_PATH);
    if (index < 0) return value;
    return `${parsed.pathname.slice(index)}${parsed.search}`;
  } catch {
    return value;
  }
}

/**
 * Rewrites Gracon editor-image render URLs to the current frontend origin.
 *
 * @param payload Documents-service JSON response.
 * @returns A cloned payload containing only same-origin editor asset paths.
 */
export function rewriteEditorImageUrls(payload: unknown): unknown {
  if (typeof payload === "string") return rewriteEditorImageString(payload);
  if (Array.isArray(payload)) return payload.map(rewriteEditorImageUrls);
  if (!payload || typeof payload !== "object") return payload;

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      rewriteEditorImageUrls(value),
    ]),
  );
}
