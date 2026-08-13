import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookies,
  getSessionCookies,
} from "@/lib/server/session-proxy";
import { isSameOriginMutation } from "@/lib/server/backend-proxy-policy";
import { getServiceBase } from "@/lib/server/service-origins";

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

  if (refreshToken) {
    try {
      await fetch(`${getServiceBase("auth")}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // Local logout must still clear browser cookies even if the auth
      // service is temporarily unavailable or already revoked the token.
    }
  }

  return clearSessionCookies(NextResponse.json({ success: true }));
}
