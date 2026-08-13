/**
 * Local session-upgrade route for app/documents.
 *
 * This upgrades a stale limited session after identity verification completes
 * in app/app, then writes the refreshed full-token pair into shared cookies.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  applySessionCookies,
  clearSessionCookies,
  getSessionCookies,
  refreshSession,
} from "@/lib/server/session-proxy";
import { isSameOriginMutation } from "@/lib/server/backend-proxy-policy";

/**
 * Upgrades the shared refresh-token session to full access when auth allows it.
 */
export async function POST(request: NextRequest) {
  if (
    !isSameOriginMutation(
      request.nextUrl,
      request.headers.get("origin"),
      request.headers.get("sec-fetch-site"),
    )
  ) {
    return NextResponse.json(
      { message: "Cross-origin request rejected" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { refreshToken } = getSessionCookies(request);

  if (!refreshToken) {
    return clearSessionCookies(
      NextResponse.json({ error: "No refresh token" }, { status: 401 }),
    );
  }

  try {
    const tokens = await refreshSession(refreshToken, "upgrade");

    if (!tokens || tokens.tokenType !== "full") {
      return NextResponse.json(
        { error: "Identity verification is still required" },
        { status: 403 },
      );
    }

    return applySessionCookies(
      NextResponse.json({
        accessToken: tokens.accessToken,
        tokenType: tokens.tokenType,
      }),
      tokens,
    );
  } catch {
    return NextResponse.json(
      { error: "Auth service unavailable" },
      { status: 503 },
    );
  }
}
