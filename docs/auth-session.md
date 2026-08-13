# Authentication And Session Rules

Purpose: keep development login, production shared sessions, refresh, logout, and cross-app identity handoffs predictable without making the documents browser a token authority.

## Ownership

- `app/app` owns identity UI, account preferences, and production login handoff.
- `api/auth` owns authentication, session issuance, refresh rotation, reuse detection, and identity state.
- `app/documents` owns document UI and same-origin session proxy handlers.
- `api/documents` owns document access and permission enforcement.

Do not recreate identity verification or mint/validate JWTs in browser code.

## Supported Modes

Development compatibility:

- local documents login may remain available;
- readable-cookie behavior must be explicitly enabled by development flags;
- development behavior must not silently become the production default.

Production:

- set `DOCUMENTS_USE_MAIN_APP_LOGIN=true` and its public UI counterpart as required by the current deployment contract;
- disable development-readable auth cookies;
- use parent-domain `HttpOnly`, `Secure`, policy-appropriate `SameSite` cookies;
- validate the session server-side through local route handlers;
- use hard navigation to `app/app` for login and identity verification.

Environment flags are configuration, not authorization. Server code must fail closed when production cookie policy is unsafe or incomplete.

## Session Validation

- `/api/session` is the browser-facing validation boundary for protected route hydration.
- `/api/me` returns only the user fields required by the documents UI.
- The `session_active` cookie is a routing/presence hint only.
- Do not render private document content until session recovery and document authorization complete.
- Validate proxy responses before merging them into client state.
- Malformed, expired, revoked, or incomplete sessions clear local session/document state and enter the approved login handoff.
- A valid identity session still does not grant access to a specific document.

## Refresh And Upgrade

- Use the server-owned single-flight refresh/upgrade helpers.
- Concurrent requests must share one eligible refresh attempt.
- Mark retried requests so refresh cannot loop.
- Refresh only authentication failures eligible under the existing contract; never refresh 403 or domain failures.
- Rotate cookies atomically before releasing queued work.
- Reject every waiter when refresh fails; no request may remain pending indefinitely.
- Reuse detection or terminal refresh failure must clear the documents-visible session and force a fresh login.
- Do not expose refresh tokens or upstream Set-Cookie internals to client JavaScript.

## Redirect Safety

- Cross-origin app handoffs use hard navigation.
- Generate `next` values through shared safe helpers rather than string concatenation.
- Allow only intended same-origin document paths for return navigation.
- Never preserve `/login`, `/logout`, protocol-relative, absolute, JavaScript, or external destinations as a post-login path.
- Preserve invitation/document context only when it does not leak secrets to the identity-app URL, history, logs, or referrer.
- Profile and Settings point to the configured `app/app` origin because account preferences are identity-owned.

## Identity Verification Handoff

- The documents app displays the need for identity verification but does not host the verification UI.
- Redirect to `app/app` with an opaque, safe return contract.
- On return, validate the shared session and refetch readiness/access; never trust a query flag claiming verification succeeded.
- Invitation and signing flows resume from backend state, not from preserved modal state alone.
- Avoid redirect loops by distinguishing missing session, missing verification, and transient service failure.

## Logout

- UI logout must call `logoutFromDocuments()` and the local `/api/logout` route.
- Attempt backend refresh-session revocation when the session contract permits it.
- Clear local/shared document-visible cookies and client session state even if the revocation request fails.
- Clear document content, editor instances, collaborator/share state, cached profile data, sensitive reveals, and pending requests.
- Return to the documents `/login` route for a clean re-entry path.
- Never preserve `/logout` as `next` or bounce immediately into an `app/app` login loop.

## Cookie Rules

- Production credentials are `HttpOnly`; JavaScript-readable cookie compatibility is development-only.
- Apply domain, `Secure`, `SameSite`, path, expiry, and deletion attributes consistently.
- Cookie deletion must match the attributes/path/domain used to set the cookie.
- Do not copy raw upstream cookies blindly across origins.
- Never place document permissions or sensitive profile data in an unsigned routing cookie.
- Update `.env.example`, `SECURITY.md`, and deployment validation whenever cookie policy changes.

## Failure Semantics

- 401: one eligible server-owned recovery attempt, then clear and hand off to login.
- 403: retain valid identity session, deny document/action access, and do not refresh.
- 404: show missing/unavailable without leaking whether a private record exists to an unauthorized user.
- 409/stale state: refetch document or invitation state and require the user to review again.
- 429: respect retry guidance and do not create a request loop.
- 5xx/network: preserve safe state, provide recovery, and do not mislabel as logout unless session recovery definitively failed.

## Session Change Checklist

- Development and production modes remain explicitly separated.
- Browser code never reads a production refresh token.
- Same-origin handlers validate fixed upstreams and safe redirects.
- Concurrent refresh settles all callers.
- Logout clears credentials, caches, editors, and sensitive state.
- Cross-app return is safe and cannot loop through login/logout.
- Session validity and document authorization remain separate checks.
- Security baseline and session tests cover the change.
