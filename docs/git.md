# Git Handoff Rules

Purpose: make every documents-app change independently reviewable and provide exact commands for the developer to run.

## Absolute Rule

Codex must never execute Git commands in this project. This includes read-only commands such as `git status`, `git diff`, and `git log`, as well as mutating commands.

Git commands may be presented only as copy-paste text for the developer.

## One File Per Commit

Every changed, added, renamed, or deleted file requires its own commit.

For each file, provide exactly:

```bash
git add "path/to/one-file.ts"
git commit -m "type(scope): lowercase description"
```

Then provide a separate pair for the next file. A commit must not contain more than one file, even when several files form one documentation move, schema feature, test update, or import/export change.

## Path Rules

- Paths are relative to `app/documents/`, where this `package.json` lives.
- Always quote the path.
- Use one explicit path per `git add`.
- Stage a deletion with its exact old path using `git add "agents/file.md"`.
- For a rename or relocation, the destination addition and source deletion still receive separate commit pairs because the one-file rule is literal.
- Never include `cd app/documents` in a command block.

## Forbidden Commands

Never run or recommend:

```text
git add .
git add -A
git commit -am ...
git push
git reset --hard
git clean -fd
```

Do not use globs, directory-wide staging, interactive staging, or commands that stage several files.

## Commit Format

Use Conventional Commits:

```text
type(scope): short lowercase description
```

Allowed types include `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`, `security`, and `perf`.

Common scopes:

- `documents` — lists, routes, folders, cards, and document-domain UI;
- `editor` — TipTap, canvas, toolbar, rulers, page setup, preview, and pagination;
- `export` — PDF/DOCX capture and conversion;
- `import` — DOCX/PDF import and normalization;
- `templates` — template UI;
- `invitations` — sharing, gates, and acceptance;
- `signature` — readiness, signing, evidence, and lock workflow;
- `auth` — session, login/logout, cookies, and cross-app handoff;
- `security` — security baseline, CSP, safe URLs, assets, and exposure prevention;
- `shared` — shared shell, components, hooks, and types;
- `ui` — generic primitives and design-system behavior;
- `docs` — documentation and project rules.

## Message Rules

- Use lowercase after the colon.
- Use imperative mood.
- Describe only the staged file's purpose.
- Do not claim behavior implemented by another file.
- Use `security` only for actual security hardening; use `docs` for documentation-only security rules.
- Keep the subject concise and omit a trailing period.

## Required Handoff Check

Before presenting commands:

1. Enumerate every changed, added, renamed, and deleted file without using Git.
2. Match each file to exactly one `git add` and one `git commit` command.
3. Confirm every path is quoted and relative to `app/documents/`.
4. Confirm no pair stages more than one file.
5. Confirm no push command is included.

## Example

```bash
git add "src/lib/document-readonly.ts"
git commit -m "fix(editor): preserve signed document immutability"

git add "test/editor/document-readonly.test.ts"
git commit -m "test(editor): cover signed document view states"
```
