/**
 * Shared server-side session proxy helpers for app/documents.
 *
 * Next.js route handlers use this file when forwarding authenticated requests
 * to auth/signature services. The single-flight refresh map is intentionally
 * process-local and keyed by a hash so parallel proxy requests do not rotate
 * the same refresh token more than once.
 */
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  documentAuthCookiePolicy,
  shouldAllowReadableDocumentAuthCookies,
} from "@/lib/auth/session-cookie-policy";
import { getServiceBase } from "./service-origins";

export type RefreshedTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: "full" | "limited";
};

type RefreshMode = "refresh" | "upgrade";

const pendingRefreshes = new Map<string, Promise<RefreshedTokens | null>>();

function hashRefreshToken(refreshToken: string) {
  return crypto.createHash("sha256").update(refreshToken).digest("hex");
}

function getRefreshPath(mode: RefreshMode) {
  return mode === "upgrade" ? "/auth/session/upgrade" : "/auth/refresh";
}

/**
 * Reads shared auth cookies from a Next.js route request.
 */
export function getSessionCookies(request: NextRequest) {
  return {
    accessToken:
      request.cookies.get(documentAuthCookiePolicy.accessCookieName)?.value ??
      null,
    refreshToken:
      request.cookies.get(documentAuthCookiePolicy.refreshCookieName)?.value ??
      null,
  };
}

/**
 * Rotates or upgrades the current refresh token with single-flight protection.
 */
export function refreshSession(
  refreshToken: string,
  mode: RefreshMode = "refresh",
): Promise<RefreshedTokens | null> {
  const key = `${mode}:${hashRefreshToken(refreshToken)}`;
  const pending = pendingRefreshes.get(key);
  if (pending) return pending;

  const refresh = fetch(`${getServiceBase("auth")}${getRefreshPath(mode)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  })
    .then(async (response) => {
      if (!response.ok) return null;

      const data = await response.json();
      const payload = data?.data ?? data;

      if (!payload?.accessToken || !payload?.refreshToken) return null;

      const tokenType: RefreshedTokens["tokenType"] =
        payload.tokenType === "limited" ? "limited" : "full";

      return {
        accessToken: payload.accessToken as string,
        refreshToken: payload.refreshToken as string,
        tokenType,
      };
    })
    .finally(() => {
      pendingRefreshes.delete(key);
    });

  pendingRefreshes.set(key, refresh);
  return refresh;
}

/**
 * Clears shared auth cookies after the auth service confirms the session is no
 * longer recoverable.
 */
export function clearSessionCookies<T extends NextResponse>(response: T): T {
  const options = {
    maxAge: 0,
    path: "/",
    sameSite: documentAuthCookiePolicy.cookieSameSite,
    secure: documentAuthCookiePolicy.cookieSecure,
    domain: documentAuthCookiePolicy.cookieDomain,
  };

  response.cookies.set(documentAuthCookiePolicy.accessCookieName, "", {
    ...options,
  });
  response.cookies.set(documentAuthCookiePolicy.refreshCookieName, "", {
    ...options,
  });
  response.cookies.set(documentAuthCookiePolicy.sessionHintCookieName, "", {
    ...options,
  });
  return response;
}

/**
 * Applies a rotated auth session to the shared cookie names used by Gracon apps.
 */
export function applySessionCookies<T extends NextResponse>(
  response: T,
  tokens: RefreshedTokens,
): T {
  const commonOptions = {
    path: "/",
    sameSite: documentAuthCookiePolicy.cookieSameSite,
    secure: documentAuthCookiePolicy.cookieSecure,
    domain: documentAuthCookiePolicy.cookieDomain,
    httpOnly: !shouldAllowReadableDocumentAuthCookies(),
  };

  response.cookies.set(
    documentAuthCookiePolicy.accessCookieName,
    tokens.accessToken,
    {
      ...commonOptions,
      maxAge: documentAuthCookiePolicy.accessTokenMaxAgeSeconds,
    },
  );
  response.cookies.set(
    documentAuthCookiePolicy.refreshCookieName,
    tokens.refreshToken,
    {
      ...commonOptions,
      maxAge: documentAuthCookiePolicy.refreshTokenMaxAgeSeconds,
    },
  );
  response.cookies.set(documentAuthCookiePolicy.sessionHintCookieName, "1", {
    maxAge: documentAuthCookiePolicy.refreshTokenMaxAgeSeconds,
    path: "/",
    sameSite: documentAuthCookiePolicy.cookieSameSite,
    secure: documentAuthCookiePolicy.cookieSecure,
    domain: documentAuthCookiePolicy.cookieDomain,
  });

  return response;
}

/**
 * Ensures a route handler has an access token, refreshing from cookies when the
 * browser only still has a valid refresh token.
 */
export async function resolveAccessToken(
  request: NextRequest,
  mode: RefreshMode = "refresh",
): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  refreshedTokens: RefreshedTokens | null;
}> {
  const { accessToken, refreshToken } = getSessionCookies(request);

  if (accessToken || !refreshToken) {
    return { accessToken, refreshToken, refreshedTokens: null };
  }

  const refreshedTokens = await refreshSession(refreshToken, mode);

  return {
    accessToken: refreshedTokens?.accessToken ?? null,
    refreshToken,
    refreshedTokens,
  };
}

/**
 * Copies an upstream response body/status and writes any rotated cookies.
 */
export async function forwardResponseWithSession(
  upstreamResponse: Response,
  refreshedTokens: RefreshedTokens | null,
): Promise<NextResponse> {
  const response = new NextResponse(await upstreamResponse.text(), {
    status: upstreamResponse.status,
    headers: {
      "Content-Type":
        upstreamResponse.headers.get("content-type") ?? "application/json",
    },
  });

  if (upstreamResponse.status === 401) {
    clearSessionCookies(response);
  } else if (refreshedTokens) {
    applySessionCookies(response, refreshedTokens);
  }

  return response;
}
