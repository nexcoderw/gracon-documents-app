import { NextRequest, NextResponse } from "next/server";
import {
  applySessionCookies,
  clearSessionCookies,
  getSessionCookies,
  refreshSession,
} from "@/lib/server/session-proxy";
import { isSameOriginMutation } from "@/lib/server/backend-proxy-policy";

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
    const response = NextResponse.json(
      { error: "No refresh token" },
      { status: 401 },
    );
    return clearSessionCookies(response);
  }

  try {
    const tokens = await refreshSession(refreshToken);

    if (!tokens) {
      const response = NextResponse.json(
        { error: "Refresh failed" },
        { status: 401 },
      );
      return clearSessionCookies(response);
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
