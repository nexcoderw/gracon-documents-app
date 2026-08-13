# Signing, Sharing, And Invitation Rules

Purpose: keep collaboration, proof gates, signing readiness, immutable evidence, and owner lock aligned with backend authority.

## Workflow Ownership

- `api/documents` owns document permissions, invitation requirements, readiness state, workflow transitions, and signature evidence recording.
- `api/auth` owns login, email/identity proof, and user preference defaults.
- `api/signature` owns personal certificates and cryptographic signing.
- The documents frontend presents these workflows and uses same-origin server handlers where direct browser calls would weaken the boundary.

Frontend state never replaces an authoritative permission, proof, readiness, signature, or lock check.

## Sharing And Permissions

- Show the current document, target collaborator, permission, and verification requirements before submission.
- Distinguish view, edit, comment, sign, or other supported permissions explicitly.
- Fetch invitation defaults from auth-owned preferences through the same-origin documents proxy.
- Defaults preselect controls only. Login and all backend-required gates remain mandatory.
- Do not infer collaborator identity from an email label after the backend returns a canonical subject.
- Prevent duplicate invites and expose safe duplicate/conflict responses.
- Refetch access state after add, update, revoke, or resend operations.
- Cross-tab updates merge only document/share metadata they own and must not overwrite newer editor content or permissions.

## Invitation Review

- Treat the invitation token as a secret and the review page as a protected proof flow.
- Show document/owner context only after the backend authorizes safe disclosure.
- Present required gates separately: login, OTP, identity verification, acceptance, and resulting permission.
- Never show raw proof internals, hashed values, token status detail, or private collaborator metadata.
- Expired, revoked, consumed, wrong-recipient, already-accepted, denied, and temporarily unavailable states need distinct safe recovery.
- Return from login or verification by reloading authoritative invitation state, not by trusting query flags.

## OTP And Identity Gates

- Login is always required for secure invitation acceptance.
- OTP values are transient secrets: never persist, log, analyze, or place them in URLs.
- Throttle/resend timers are presentation of backend policy, not enforcement.
- Identity verification remains in `app/app`; use hard navigation with a safe opaque return path.
- After return, refetch session, identity state, invitation gates, and document access.
- A preference value of “no extra verification” never disables a gate required by `api/documents`.

## Acceptance State Machine

Use explicit states:

```text
review -> login required -> otp required -> identity required -> ready
ready -> accepting -> accepted -> load authorized document
                  -> failed or uncertain -> refetch invitation state
```

- Disable duplicate acceptance while pending.
- Do not automatically retry acceptance.
- A timeout after submission is uncertain; refetch before offering another attempt.
- Do not load private document content until acceptance and document authorization are confirmed.

## Signing Readiness

- Use one `api/documents` readiness request before opening the signing modal.
- Readiness must return the next state needed by the UI: login, identity verification, certificate setup, unavailable, or ready to sign.
- Reuse one fresh readiness state across header, progress rail, and return-to-modal handoff where practical.
- Invalidate readiness when document version/status, signer, session, permission, certificate state, or required signature block changes.
- Do not infer readiness by independently probing profile, certificate, and document endpoints from the browser.
- After cross-app setup, refetch readiness; do not trust a return query parameter.

## Finalisation

- Finalisation is a deliberate state transition separate from signing and lock.
- Confirmation must explain that content editing will stop according to the backend workflow.
- Prevent finalisation against a stale document version.
- On success, switch the editor to read-only immediately and refetch workflow state.
- On failure or uncertainty, do not pretend the draft remains editable until authoritative state is reconciled.

## Signing

- Submit signing through the local signing orchestration route, which coordinates `api/signature` and signature evidence recording in `api/documents`.
- Do not expose private key material, internal certificate secrets, service credentials, or raw signing internals.
- Bind the request to the intended document, version/hash, signer, signature block, and current readiness contract.
- Disable duplicate signing submissions.
- Do not retry signing automatically after timeout or connection loss.
- On success, make the editor read-only immediately, refresh evidence/progress, and preserve return-to-modal state only as needed.
- On uncertain outcome, refetch document signatures and readiness before another attempt.

## Signing Progress And Evidence

- The progress rail lives outside printable geometry and remains fixed to the visible canvas region.
- Show required signers, completed signers, current status, and next valid action without exposing private account data.
- Evidence blocks and signature imagery are representations of backend-recorded evidence, not cryptographic proof by themselves.
- QR verification remains centered at the bottom of the supported signed page surface and matches preview/export/public verification semantics.
- Do not shift ruler, paper size, margins, or page capture because progress UI opens.
- Signed evidence must render safely in read-only editor and print preview even when an individual image fails.

## Owner Lock

- Owner lock follows finalisation/signing requirements defined by the backend.
- Keep it behind an explicit confirmation naming the document and permanent consequence.
- Never combine owner lock with signing as an implicit side effect.
- Disable duplicate lock submissions and treat lost responses as uncertain.
- After success, refetch state and keep all editing paths disabled.
- Non-owners must not see an actionable lock affordance, while the backend still enforces ownership.

## Failure And Audit Rules

- Map 401, 403, 404, 409/stale, 422/gate, 429, 5xx, network, and uncertain outcomes distinctly.
- Preserve safe user input on recoverable failures, excluding tokens, OTPs, and secrets.
- Do not render backend stacks, cryptographic errors, private ids, or proof internals.
- Privileged transitions must correspond to backend audit/evidence records.
- Refetch authoritative state after every confirmed or uncertain mutation.

## Workflow Checklist

- Backend owner and required permission are explicit.
- Invitation defaults remain defaults only.
- Return paths are safe and secrets are not propagated.
- Readiness is fresh and invalidated by relevant state changes.
- Finalise, sign, and owner lock remain distinct.
- Stale version, duplicate submit, timeout, and conflict are safe.
- Successful finalise/sign/lock immediately enforces read-only state.
- Evidence and QR behavior match preview/export/public verification.
- Focused tests cover state transitions and readonly policy.
