# SheDrive — Development Rules

## 1. What We Use
- Female-only passenger/driver product
- Lahore/Pakistan-first decisions
- PKR
- Safety and privacy first
- Original SheDrive branding
- Existing working architecture preserved unless approved for redesign
- Existing dependency versions frozen by default
- Client + server validation
- Server-authoritative business rules
- Explicit loading/success/empty/error states
- Audit logs for critical admin/security/payment actions

## 2. What to Avoid
- No blind dependency upgrades/downgrades
- No unnecessary architecture replacement
- No duplicate authentication systems
- No fake production data
- No hardcoded secrets
- No `.env` secrets committed to Git
- No admin credentials in the mobile app
- No client-only authorization
- No plain-text passwords
- No in-app wallet unless explicitly approved
- No Google/Apple social login unless explicitly approved
- No feature added just because a UI template contains it
- Do not remove working functionality merely to fit a template

## Libraries
Before adding a package:
1. Check existing libraries.
2. Check compatibility.
3. Explain necessity.
4. Produce a plan.
5. Obtain approval when architecture/build stability may be affected.

## Error Handling
Important operations must handle loading, success, validation, auth/permission errors, network/server errors, external-service failure, empty states and retry/recovery where applicable.

Never silently swallow important errors.

## AI Boundaries
Before major architectural changes:
- Inspect repository and versions.
- Identify affected files and risks.
- Make an implementation plan.
- Wait for approval when required.

During implementation:
- Stay within the approved phase.
- Do not silently change unrelated files.
- Do not change dependency versions without approval.
- Test/build after changes.

Before completion:
- Verify end-to-end behavior.
- Verify affected mobile/backend/admin/website flows.
- Check Git diff.
- Check for secrets.
- Report remaining issues.

## Git Security
Never commit API secrets, database passwords, SMTP credentials, Firebase private keys, service-account files, private signing keys or production credentials.

If a secret is discovered: stop, remove it from tracked files, rotate it, and report it.
