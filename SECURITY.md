# app/documents Security

`app/documents` owns the document workspace UI. Identity, permission
enforcement, signing authority, and storage credentials remain in backend
services.

## Session Boundary

- Production login should use `app/app` with parent-domain `HttpOnly` cookies.
- Browser code must validate sessions through same-origin route handlers such
  as `/api/session`, `/api/me`, `/api/refresh`, and `/api/logout`.
- Do not add production code that requires reading refresh tokens from
  `document.cookie`.
- Local development login and readable-cookie compatibility may remain behind
  explicit development flags.

## Documents And Invitations

- `api/documents` enforces document permissions and invitation gates.
- User preference defaults are UI preselection only; they must never skip
  backend invitation verification.
- Invitation OTP and identity verification returns must preserve only safe
  document-app paths.
- `/logout` and `/login` must never be preserved as post-login destinations.

## Assets And Signing

- Profile images must render through `/api/profile-image` and shared avatar
  fallbacks, not raw presigned URLs in shell DOM.
- Editor images must be hosted through `api/documents`; base64 document JSON
  storage is blocked.
- Signing readiness must come from backend readiness checks.
- Signed, finalised, and locked documents must remain read-only in the editor.

## Required Checks

```bash
npm run check:security
npm run lint
npm run test
npm run build
npm audit --audit-level=high
```

Run deployment env validation with real production env values before release:

```bash
CHECK_DEPLOY_ENV=true npm run check:security
```

## Browser Hardening

- `next.config.ts` owns the app-wide CSP and security headers.
- The app security workflow runs Gitleaks before install/build steps.
- Browser storage checks prevent token-like, invite-like, recording-like, and
  private identifier values from being added to persistent browser storage.
- Collaborator avatars use initials unless they can be rendered through an
  approved same-origin profile-image route. Raw presigned profile-image URLs
  must not be placed in document UI DOM.
