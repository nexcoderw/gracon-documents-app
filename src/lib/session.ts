/**
 * Session utilities for app/documents.
 *
 * app/documents uses the shared auth service, but now owns its
 * own login route and session bootstrap flow.
 *
 * These cookies are readable here because both apps run on the same
 * host (localhost in dev, same root domain in production).
 */
import { documentAuthCookiePolicy, shouldUseMainAppLogin } from '@/lib/auth/session-cookie-policy';

export const APP_URL =
    process.env.NEXT_PUBLIC_MAIN_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:4000';
export const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? 'http://localhost:4002';
const SESSION_API_BASE = '/api';
const DEFAULT_NEXT_PATH = '/documents';
const DIGITAL_CERTIFICATE_PATH = '/profile/signature';
const IDENTITY_VERIFICATION_PATH = '/verify-identity';
const PROFILE_SETTINGS_PATH = '/settings/profile';
const WORKSPACE_SETTINGS_PATH = '/settings';
const BLOCKED_NEXT_PATHS = new Set(['/logout', '/login']);

export type SessionRefreshResult =
    | {
          status: 'refreshed';
          accessToken: string;
      }
    | {
          status: 'unauthenticated';
      }
    | {
          status: 'unavailable';
          message: string;
      };

export type SessionBootstrapResult =
    | {
          status: 'authenticated';
          user: Record<string, unknown>;
      }
    | {
          status: 'unauthenticated';
      }
    | {
          status: 'unavailable';
          message: string;
      };

export function normalizeDocsPath(path: string | null | undefined): string {
    if (!path) return DEFAULT_NEXT_PATH;

    if (path.startsWith('/')) {
        try {
            const parsed = new URL(path, DOCS_URL);
            if (BLOCKED_NEXT_PATHS.has(parsed.pathname)) {
                return DEFAULT_NEXT_PATH;
            }

            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        } catch {
            return DEFAULT_NEXT_PATH;
        }
    }

    try {
        const docsOrigin = new URL(DOCS_URL).origin;
        const url = new URL(path);

        if (url.origin === docsOrigin) {
            if (BLOCKED_NEXT_PATHS.has(url.pathname)) {
                return DEFAULT_NEXT_PATH;
            }

            return `${url.pathname}${url.search}${url.hash}`;
        }
    } catch {
        // Ignore malformed absolute URLs and fall through.
    }

    return DEFAULT_NEXT_PATH;
}

/**
 * Builds the main-app URL where users manage keys and digital certificates.
 */
export function getDigitalCertificateUrl(nextPath?: string): string {
    const url = new URL(DIGITAL_CERTIFICATE_PATH, APP_URL);
    if (nextPath) {
        url.searchParams.set('next', new URL(nextPath, DOCS_URL).toString());
    }
    return url.toString();
}

export function getIdentityVerificationUrl(nextPath?: string): string {
    const url = new URL(IDENTITY_VERIFICATION_PATH, APP_URL);
    if (nextPath) {
        url.searchParams.set('next', new URL(nextPath, DOCS_URL).toString());
    }
    return url.toString();
}

/**
 * Builds the main identity-app profile URL used by documents account menus.
 *
 * @returns Absolute URL for the profile page in app/app.
 */
export function getMainAppProfileUrl(): string {
    return new URL(PROFILE_SETTINGS_PATH, APP_URL).toString();
}

/**
 * Builds the main identity-app workspace settings URL used by documents account menus.
 *
 * @returns Absolute URL for the settings page in app/app.
 */
export function getMainAppSettingsUrl(): string {
    return new URL(WORKSPACE_SETTINGS_PATH, APP_URL).toString();
}

export async function logoutFromDocuments(): Promise<void> {
    try {
        await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
        });
    } catch {
        // The user must still leave the protected workspace if the auth service
        // is temporarily unavailable or the refresh token was already revoked.
    }

    window.location.href = '/login';
}

function getUnavailableMessage(payload: unknown, fallback: string): string {
    const message = (payload as { message?: string; error?: string } | null)?.message
        ?? (payload as { message?: string; error?: string } | null)?.error;

    return typeof message === 'string' && message.trim() ? message : fallback;
}

/**
 * Reads the access token from the shared cookie.
 */
export function getAccessToken(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(
        new RegExp(`(?:^|;\\s*)${documentAuthCookiePolicy.accessCookieName}=([^;]+)`),
    );
    return match?.[1] ?? null;
}

/**
 * Redirects the user to the local documents login page with a ?next param
 * so they are sent back to their intended page after login.
 */
export function redirectToLogin(intendedPath = DEFAULT_NEXT_PATH): void {
    if (typeof window === 'undefined') return;
    const next = normalizeDocsPath(intendedPath);
    if (shouldUseMainAppLogin()) {
        const loginUrl = new URL('/login', APP_URL);
        loginUrl.searchParams.set('next', new URL(next, DOCS_URL).toString());
        window.location.href = loginUrl.toString();
        return;
    }

    window.location.href = `/login?next=${encodeURIComponent(next)}`;
}

/**
 * Refreshes the access token by calling the local same-origin /api/refresh route.
 */
export async function refreshAccessToken(): Promise<SessionRefreshResult> {
    try {
        const res = await fetch(`${SESSION_API_BASE}/refresh`, {
            method: 'POST',
            credentials: 'include',
        });

        if (res.ok) {
            const data = await res.json();
            if (typeof data?.accessToken === 'string' && data.accessToken) {
                return { status: 'refreshed', accessToken: data.accessToken };
            }

            return {
                status: 'unavailable',
                message: 'The authentication service returned an incomplete refresh response.',
            };
        }

        if (res.status === 401) {
            return { status: 'unauthenticated' };
        }

        const payload = await res.json().catch(() => null);
        return {
            status: 'unavailable',
            message: getUnavailableMessage(
                payload,
                'Unable to refresh your session right now.',
            ),
        };
    } catch {
        return {
            status: 'unavailable',
            message: 'Unable to reach the authentication service right now.',
        };
    }
}

/**
 * Fetches the current user profile from the local same-origin /api/session route.
 */
export async function fetchCurrentUser(): Promise<SessionBootstrapResult> {
    try {
        const res = await fetch(`${SESSION_API_BASE}/session`, {
            credentials: 'include',
            cache: 'no-store',
        });

        if (res.ok) {
            const data = await res.json();
            return {
                status: 'authenticated',
                user: (data?.user ?? data?.data ?? data) as Record<string, unknown>,
            };
        }

        if (res.status === 401) {
            return { status: 'unauthenticated' };
        }

        const payload = await res.json().catch(() => null);
        return {
            status: 'unavailable',
            message: getUnavailableMessage(
                payload,
                'Unable to validate your session right now.',
            ),
        };
    } catch {
        return {
            status: 'unavailable',
            message: 'Unable to reach the authentication service right now.',
        };
    }
}
