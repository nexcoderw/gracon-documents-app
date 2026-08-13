/**
 * Fixed server-side transport for registered document workspace operations.
 */

import "server-only";
import { NextRequest, NextResponse } from "next/server";
import {
  applySessionCookies,
  clearSessionCookies,
  getSessionCookies,
  resolveAccessToken,
  type RefreshedTokens,
} from "./session-proxy";
import {
  buildBackendUrl,
  getPathParam,
  isSameOriginMutation,
  redactRefreshTokens,
  rewriteEditorImageUrls,
} from "./backend-proxy-policy";
import {
  getServiceBase,
  type DocumentsBackendService,
} from "./service-origins";

type RequestBodyKind = "none" | "json" | "multipart";
type ResponseBodyKind = "json" | "binary";
type AuthenticationKind = "none" | "optional" | "access";
type RouteParams = Record<string, string | string[] | undefined>;

interface BackendRouteConfig {
  service: DocumentsBackendService;
  upstreamPath: string | ((params: RouteParams) => string);
  authentication?: AuthenticationKind;
  body?: RequestBodyKind;
  response?: ResponseBodyKind;
  allowedQueryParams?: readonly string[];
  maxRequestBytes?: number;
  maxResponseBytes?: number;
  timeoutMs?: number;
  sessionResponse?: boolean;
  injectRefreshToken?: boolean;
  rewriteDocumentAssets?: boolean;
}

interface RouteContext {
  params: Promise<RouteParams>;
}

const DEFAULT_JSON_LIMIT = 1024 * 1024;
const DEFAULT_RESPONSE_LIMIT = 12 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function shouldCheckOrigin(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method);
}

function findSessionTokens(payload: unknown): RefreshedTokens | null {
  if (!payload || typeof payload !== "object") return null;
  const object = payload as Record<string, unknown>;
  if (
    typeof object.accessToken === "string" &&
    typeof object.refreshToken === "string"
  ) {
    return {
      accessToken: object.accessToken,
      refreshToken: object.refreshToken,
      tokenType: object.tokenType === "limited" ? "limited" : "full",
    };
  }

  for (const key of ["data", "tokens"]) {
    const nested = findSessionTokens(object[key]);
    if (nested) return nested;
  }
  return null;
}

async function readRequestBody(
  request: NextRequest,
  config: BackendRouteConfig,
): Promise<BodyInit | undefined> {
  const bodyKind = config.body ?? "none";
  if (bodyKind === "none") return undefined;

  const maxBytes = config.maxRequestBytes ?? DEFAULT_JSON_LIMIT;
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RangeError("Request body is too large");
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (bodyKind === "json") {
    if (!contentType.toLowerCase().startsWith("application/json")) {
      throw new TypeError("Expected application/json");
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > maxBytes) {
      throw new RangeError("Request body is too large");
    }
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TypeError("Expected a JSON object");
    }

    if (config.injectRefreshToken) {
      const { refreshToken } = getSessionCookies(request);
      if (!refreshToken) {
        throw new DOMException("Missing credential", "NotAllowedError");
      }
      (parsed as Record<string, unknown>).refreshToken = refreshToken;
    }
    return JSON.stringify(parsed);
  }

  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new TypeError("Expected multipart/form-data");
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > maxBytes) {
    throw new RangeError("Request body is too large");
  }
  return body;
}

function buildResponseHeaders(upstream: Response): Headers {
  const headers = new Headers({ "Cache-Control": "no-store" });
  const contentType = upstream.headers.get("content-type");
  const disposition = upstream.headers.get("content-disposition");
  const retryAfter = upstream.headers.get("retry-after");
  if (contentType) headers.set("Content-Type", contentType);
  if (disposition) headers.set("Content-Disposition", disposition);
  if (retryAfter) headers.set("Retry-After", retryAfter);
  return headers;
}

function applyRotatedSession(
  response: NextResponse,
  refreshedTokens: RefreshedTokens | null,
  upstreamStatus: number,
): NextResponse {
  if (upstreamStatus === 401) return clearSessionCookies(response);
  if (refreshedTokens) return applySessionCookies(response, refreshedTokens);
  return response;
}

/**
 * Creates a route handler bound to one reviewed backend operation.
 *
 * @param config Fixed service, path, authentication, and transport policy.
 * @returns A Next.js handler that cannot proxy arbitrary URLs or paths.
 */
export function createBackendRoute(config: BackendRouteConfig) {
  return async function backendRoute(
    request: NextRequest,
    context: RouteContext,
  ): Promise<NextResponse> {
    if (
      shouldCheckOrigin(request.method) &&
      !isSameOriginMutation(
        request.nextUrl,
        request.headers.get("origin"),
        request.headers.get("sec-fetch-site"),
      )
    ) {
      return jsonError("Cross-origin request rejected", 403);
    }

    let accessToken: string | null = null;
    let refreshedTokens: RefreshedTokens | null = null;
    if (config.authentication && config.authentication !== "none") {
      const session = await resolveAccessToken(request);
      accessToken = session.accessToken;
      refreshedTokens = session.refreshedTokens;
    }
    if (config.authentication === "access" && !accessToken) {
      return clearSessionCookies(jsonError("Authentication required", 401));
    }

    let upstreamUrl: URL;
    let body: BodyInit | undefined;
    try {
      const params = context?.params ? await context.params : {};
      const upstreamPath =
        typeof config.upstreamPath === "function"
          ? config.upstreamPath(params)
          : config.upstreamPath;
      upstreamUrl = buildBackendUrl(
        getServiceBase(config.service),
        upstreamPath,
        request.nextUrl,
        config.allowedQueryParams ?? [],
        process.env.NODE_ENV === "production",
      );
      body = await readRequestBody(request, config);
    } catch (error) {
      if (error instanceof RangeError) {
        return jsonError("Request body is too large", 413);
      }
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        return clearSessionCookies(jsonError("Authentication required", 401));
      }
      return jsonError("Invalid request", 400);
    }

    const headers = new Headers({ Accept: "application/json" });
    const contentType = request.headers.get("content-type");
    if (body && contentType) headers.set("Content-Type", contentType);
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    if (config.service === "documents") {
      headers.set("X-Forwarded-Proto", request.nextUrl.protocol.slice(0, -1));
      headers.set("X-Forwarded-Host", request.nextUrl.host);
    }

    try {
      const upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers,
        body,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
      if (upstream.status >= 300 && upstream.status < 400) {
        return jsonError("Unexpected upstream redirect", 502);
      }
      if (upstream.status === 204) {
        return applyRotatedSession(
          new NextResponse(null, {
            status: 204,
            headers: { "Cache-Control": "no-store" },
          }),
          refreshedTokens,
          upstream.status,
        );
      }

      const raw = await upstream.arrayBuffer();
      if (
        raw.byteLength > (config.maxResponseBytes ?? DEFAULT_RESPONSE_LIMIT)
      ) {
        return jsonError("Upstream response exceeded the safe limit", 502);
      }
      if ((config.response ?? "json") === "binary") {
        const upstreamContentType = upstream.headers.get("content-type") ?? "";
        if (upstreamContentType.includes("text/html")) {
          return jsonError("Unexpected upstream response", 502);
        }
        return applyRotatedSession(
          new NextResponse(raw, {
            status: upstream.status,
            headers: buildResponseHeaders(upstream),
          }),
          refreshedTokens,
          upstream.status,
        );
      }

      const upstreamContentType = upstream.headers.get("content-type") ?? "";
      if (!/(?:application\/json|\+json)/i.test(upstreamContentType)) {
        return jsonError("Unexpected upstream response", 502);
      }
      let payload: unknown;
      try {
        payload = raw.byteLength
          ? JSON.parse(new TextDecoder().decode(raw))
          : {};
      } catch {
        return jsonError("Unexpected upstream response", 502);
      }
      if (config.rewriteDocumentAssets) {
        payload = rewriteEditorImageUrls(payload);
      }
      const tokens =
        config.sessionResponse && upstream.ok
          ? findSessionTokens(payload)
          : null;
      const browserPayload = config.sessionResponse
        ? redactRefreshTokens(payload)
        : payload;
      const response = NextResponse.json(browserPayload, {
        status: upstream.status,
        headers: buildResponseHeaders(upstream),
      });
      if (tokens) applySessionCookies(response, tokens);
      return applyRotatedSession(
        response,
        tokens ? null : refreshedTokens,
        upstream.status,
      );
    } catch (error) {
      const timedOut =
        error instanceof DOMException && error.name === "TimeoutError";
      return jsonError(
        timedOut ? "Backend request timed out" : "Backend service unavailable",
        timedOut ? 504 : 503,
      );
    }
  };
}

export { getPathParam, isSameOriginMutation };
