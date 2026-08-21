# SheDrive — AI Development Memory

## Purpose
Persistent handoff document for Antigravity, Devin and future sessions.

## Starting State
These documents define the intended product baseline. The repository may already contain partial, broken or legacy implementation. Agents must inspect actual files instead of assuming the repository matches these documents.

## What Has Been Completed
Do not invent completion status.

Use evidence from:
- Git history
- Source files
- Builds/tests
- Database/schema
- API routes
- Firebase configuration
- Admin portal
- Website
- Real-device verification

Record:

```text
[YYYY-MM-DD]
Feature:
Status: NOT STARTED / IN PROGRESS / COMPLETE / BLOCKED
Evidence:
Files:
Tests:
Known issues:
```

## Current Work
```text
Current phase:
Current feature:
Current file(s):
Reason:
Started:
```

## AI Update Routine
Before starting:
- Read all six App Documentary files.
- Inspect repository.
- Inspect dependency versions.
- Update planned work.

During work:
- Stay within approved phase.
- Record discoveries and blockers.

After work:
- Update status.
- List changed files.
- List tests/builds.
- List known issues.
- Record dependency changes.
- Record database/API/Firebase changes.
- Record Git commit if created.

## Completion Rule
A feature is COMPLETE only when implementation, required integrations, error handling, tests/builds and practical workflow verification are complete.

A visually correct screen is not a completed feature.

## Dependency Freeze
Never record a dependency change without the exact old/new versions, reason, compatibility check and required approval.

## Security
Never store secrets here. Never commit API secrets, JWT secrets, SMTP credentials, DB passwords, Firebase private keys or private signing keys.

## Handoff
Leave enough information for another agent to continue without guessing.
