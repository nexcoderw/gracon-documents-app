/**
 * Same-origin profile image renderer for app/documents.
 *
 * Auth owns profile images and returns short-lived presigned S3 URLs. This
 * route keeps those URLs out of the DOM, refreshes the user session when
 * needed, validates the private S3 profile-image source, and returns only safe
 * image bytes from the documents origin.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  applySessionCookies,
  clearSessionCookies,
  refreshSession,
  resolveAccessToken,
  type RefreshedTokens,
} from "@/lib/server/session-proxy";
import { getServiceBase } from "@/lib/server/service-origins";

const PROFILE_IMAGE_PATH_PREFIX = "/profile-images/";
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

type ProfileResolution = {
  response: Response | null;
  refreshedTokens: RefreshedTokens | null;
};

/**
 * Requests the authenticated user's profile from api/auth.
 */
async function fetchProfile(accessToken: string) {
  return fetch(`${getServiceBase("auth")}/users/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(8_000),
  });
}

/**
 * Extracts a string profile image URL from the auth profile response payload.
 */
function getProfileImageUrl(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const data =
    "data" in payload ? (payload as Record<string, unknown>).data : payload;

  if (!data || typeof data !== "object") return null;

  const value = (data as Record<string, unknown>).profileImageUrl;
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Allows only presigned S3 URLs from the private profile-images prefix.
 */
function isAllowedS3ProfileImageUrl(value: string) {
  try {
    const url = new URL(value);
    const isHttps = url.protocol === "https:";
    const isS3Host =
      url.hostname.endsWith(".amazonaws.com") ||
      url.hostname.endsWith(".amazonaws.com.cn");
    const isProfileImage = url.pathname.includes(PROFILE_IMAGE_PATH_PREFIX);
    const isPresigned = url.searchParams.has("X-Amz-Signature");

    return isHttps && isS3Host && isProfileImage && isPresigned;
  } catch {
    return false;
  }
}

/**
 * Loads the profile, using session refresh/upgrade only when the current access
 * token can no longer read the full authenticated profile.
 */
async function resolveProfile(
  request: NextRequest,
): Promise<ProfileResolution> {
  const session = await resolveAccessToken(request);
  let { accessToken, refreshedTokens } = session;
  const { refreshToken } = session;

  if (!accessToken) {
    return { response: null, refreshedTokens: null };
  }

  let profileResponse = await fetchProfile(accessToken);

  if (profileResponse.status === 403 && refreshToken) {
    const upgradedTokens = await refreshSession(refreshToken, "upgrade");
    if (upgradedTokens) {
      accessToken = upgradedTokens.accessToken;
      refreshedTokens = upgradedTokens;
      profileResponse = await fetchProfile(accessToken);
    }
  }

  if (!profileResponse.ok && refreshToken) {
    const refreshed = await refreshSession(refreshToken);
    if (refreshed) {
      accessToken = refreshed.accessToken;
      refreshedTokens = refreshed;
      profileResponse = await fetchProfile(accessToken);
    }
  }

  return { response: profileResponse, refreshedTokens };
}

/**
 * Returns the authenticated user's profile image through the documents origin.
 */
export async function GET(request: NextRequest) {
  try {
    const { response: profileResponse, refreshedTokens } =
      await resolveProfile(request);

    if (!profileResponse) {
      return clearSessionCookies(
        NextResponse.json({ message: "Not authenticated." }, { status: 401 }),
      );
    }

    if (!profileResponse.ok) {
      return clearSessionCookies(
        NextResponse.json({ message: "Session expired." }, { status: 401 }),
      );
    }

    const profilePayload: unknown = await profileResponse.json();
    const imageUrl = getProfileImageUrl(profilePayload);

    if (!imageUrl) {
      const response = NextResponse.json(
        { message: "Profile image is not configured." },
        { status: 404 },
      );
      if (refreshedTokens) applySessionCookies(response, refreshedTokens);
      return response;
    }

    if (!isAllowedS3ProfileImageUrl(imageUrl)) {
      const response = NextResponse.json(
        { message: "Profile image source is not allowed." },
        { status: 400 },
      );
      if (refreshedTokens) applySessionCookies(response, refreshedTokens);
      return response;
    }

    const imageResponse = await fetch(imageUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!imageResponse.ok) {
      const response = NextResponse.json(
        { message: "Profile image is unavailable." },
        { status: imageResponse.status },
      );
      if (refreshedTokens) applySessionCookies(response, refreshedTokens);
      return response;
    }

    const contentType =
      imageResponse.headers.get("content-type") ?? "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      const response = NextResponse.json(
        { message: "Profile image source did not return an image." },
        { status: 415 },
      );
      if (refreshedTokens) applySessionCookies(response, refreshedTokens);
      return response;
    }

    const contentLength = Number(
      imageResponse.headers.get("content-length") ?? 0,
    );
    if (contentLength > MAX_PROFILE_IMAGE_BYTES) {
      const response = NextResponse.json(
        { message: "Profile image is too large." },
        { status: 413 },
      );
      if (refreshedTokens) applySessionCookies(response, refreshedTokens);
      return response;
    }

    const body = await imageResponse.arrayBuffer();
    if (body.byteLength > MAX_PROFILE_IMAGE_BYTES) {
      const response = NextResponse.json(
        { message: "Profile image is too large." },
        { status: 413 },
      );
      if (refreshedTokens) applySessionCookies(response, refreshedTokens);
      return response;
    }

    const response = new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
      },
    });

    if (refreshedTokens) applySessionCookies(response, refreshedTokens);
    return response;
  } catch {
    return NextResponse.json(
      { message: "Unable to load profile image." },
      { status: 502 },
    );
  }
}
