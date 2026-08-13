# Route Metadata And Discoverability Rules

Purpose: give each documents route accurate metadata while keeping private workspaces, invitations, and record identifiers out of search indexes.

## Discoverability Model

- `/verify` is the only intentionally public, indexable product page in this application.
- Login, invitations, document lists, templates, creation, and editor routes must set `noindex` and `nofollow`.
- The root redirect must not become a searchable duplicate of the documents list.
- Metadata is descriptive only; it never replaces session validation, document authorization, invitation gates, or signing checks.

## Required Metadata

Every page needs a task-specific title and one-sentence description. Client pages receive static metadata from the nearest server `layout.tsx`.

Dynamic document and invitation routes must use safe task-level titles such as `Edit Document` or `Document Invitation`. Never interpolate document titles, invitation tokens, document IDs, collaborator names, email addresses, verification evidence, signature IDs, or query-string values into server metadata.

The editor may continue using `useDocumentTitle` after authorized document data loads, but that runtime browser title is private UI state and must not create indexable server metadata.

## Origins And Canonicals

- `metadataBase` uses `NEXT_PUBLIC_DOCS_URL`, which is the public documents frontend origin and defaults locally to `http://localhost:4002`.
- Never use `AUTH_API_URL`, `DOCUMENTS_API_URL`, `SIGNATURE_API_URL`, backend ports, internal hostnames, or private asset URLs in metadata.
- Public canonical metadata is appropriate only for `/verify`.

## Copy Style

- Sound trustworthy, calm, and precise.
- Describe the task and outcome without making unverified authenticity or signing claims.
- Use `users` when citizens and institution staff share the same workflow.
- Keep descriptions useful outside visual context and avoid promotional filler.

## Review Checklist

- The title and description match the route's specific job.
- Private routes inherit or declare `noindex` and `nofollow`.
- No personal, invitation, document, or cryptographic identifier appears in metadata.
- URLs resolve against frontend port `4002` locally.
- `/verify` remains public without disclosing private document content.
