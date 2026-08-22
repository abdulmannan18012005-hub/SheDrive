# SheDrive — AI Agent Project Instructions

## PROJECT

Project: SheDrive / Lahore Pink Rides

Repository:
D:\Female Only Ride ATGVT

Branch:
main

This is an existing production-oriented female-only ride-hailing platform.

The repository must be treated as an existing system.

DO NOT rebuild the project from scratch.

DO NOT replace working functionality unnecessarily.

DO NOT make large architectural changes unless explicitly required.

---

# CURRENT TECHNOLOGY STACK

## Mobile

- React Native 0.74.5
- Expo SDK ~51.0.2
- React Native Firebase 21.6.1
- TypeScript
- React Navigation
- Firebase

## Backend

- Node.js
- Express
- TypeScript
- PostgreSQL
- Supabase
- Firebase Admin
- Socket.io
- Cloudinary
- Gmail SMTP/OAuth2

## Admin Portal

- React 18.2.0
- Vite 5.4.21

## Data / Services

- Supabase PostgreSQL
- Firestore for real-time ride/chat state
- Firebase Cloud Messaging
- Cloudinary
- Gmail

---

# PHASE 0

Phase 0 established the existing architecture and baseline.

The project already had:

- Mobile passenger functionality
- Mobile driver functionality
- Backend API
- PostgreSQL/Supabase database
- Firestore real-time functionality
- Admin portal
- Static website
- Authentication
- Driver verification
- Passenger management
- Payments
- Settings
- Feedback
- Ride functionality
- Chat foundations
- Notification foundations
- Saved Places foundations
- Ride history foundations

Phase 0 also identified Admin Portal performance/reliability problems.

---

# PHASE 1 — COMPLETED

Phase 1 objective:

ADMIN PORTAL PERFORMANCE, RELIABILITY, BUILD STABILITY AND EXISTING FEATURE FUNCTIONALITY.

Phase 1 was completed and deployed.

Production commit:

bb404e00

Production:

https://shedrive.onrender.com

Phase 1 production verification:

- Mobile TypeScript: PASS
- Server build: PASS
- Admin build: PASS
- 23/23 production API/contract tests: PASS
- Driver block/unblock persistence: PASS
- Settings persistence: PASS

## Phase 1 improvements

Implemented:

- Centralized adminApi
- Authentication header handling
- TTL caching
- Request deduplication
- AbortController cancellation
- Cache invalidation
- Admin mutation migration
- Pagination
- Search debounce
- Toast notifications
- Confirmation dialogs
- Loading states
- Backend CORS hardening
- JWT validation
- Admin settings resilience
- Driver block/unblock resilience

Mobile dependencies were intentionally frozen.

Do NOT upgrade:

- React Native
- Expo
- Firebase
- Admin dependencies

unless explicitly instructed.

---

# PHASE 2 — CURRENT PHASE

Phase 2 objective:

COMPLETE EXISTING USER-FACING RIDE EXPERIENCE COMPONENTS AND CONNECT DISCONNECTED FEATURES.

Phase 2 is NOT a redesign.

Phase 2 should primarily connect and complete functionality that already exists.

---

# PHASE 2 STATUS

## Phase 2.1 — Notification Center

STATUS:

COMPLETED BY ANTIGRAVITY.

Do NOT redo it blindly.

First inspect the actual repository changes and verify what was implemented.

Expected areas included:

- Passenger navigation
- Driver navigation
- SideDrawer
- Notification Center
- Notification access from home screens
- Notification read/unread functionality

---

## Phase 2.2 — Saved Places

STATUS:

COMPLETED BY ANTIGRAVITY.

Do NOT redo it blindly.

First inspect the actual implementation.

Expected functionality:

- Saved Places backend route alignment
- Home/Work/Saved Places quick selection
- SearchScreen integration
- Existing saved_places database usage

---

## Phase 2.3 — Chat Push Notifications

STATUS:

REMAINING.

Expected:

- Connect existing ChatScreen to notification mechanism
- Send FCM notification to the other participant when appropriate
- Respect ride participation/authorization
- Do not expose sensitive information unnecessarily
- Handle missing/expired FCM tokens safely
- Preserve existing Firestore chat functionality
- Avoid duplicate notifications

---

## PHASE 2.4 — Trip Receipts

STATUS:

REMAINING.

Expected:

- Reusable TripReceiptModal
- Passenger ride history integration
- Driver ride history integration
- Itemized fare information
- Pickup/dropoff
- Date/time
- Distance
- Vehicle information
- Driver/passenger information where appropriate
- Payment status

Do not invent data fields that do not exist.

Use existing backend/database data.

---

## PHASE 2.5 — Backend Security Hardening

STATUS:

REMAINING.

Expected:

- Rate limiting for authentication/OTP endpoints
- Protection against OTP flooding
- Protection against login brute force
- Consistent API error responses where appropriate
- Preserve existing clients
- Do not break mobile authentication

Avoid unnecessary dependencies.

---

## PHASE 2.6 — Admin Audit Logs

STATUS:

REMAINING.

Expected:

- Backend GET audit logs endpoint
- Pagination
- Filtering/search where appropriate
- Admin Portal Audit Logs tab
- Reuse existing PaginationBar
- Reuse adminApi
- Display timestamp/admin/action/details
- Verify existing audit_logs data rather than creating a duplicate logging system

---

# PHASE 2.7 — SUPABASE EGRESS OPTIMIZATION

STATUS:

PLANNED / REMAINING.

This phase is specifically intended to reduce Supabase bandwidth/egress usage and therefore reduce future cost.

IMPORTANT:

Do NOT optimize blindly.

First audit:

- Supabase/PostgreSQL queries
- repeated API requests
- large SELECT responses
- SELECT *
- unnecessary columns
- polling
- duplicate requests
- pagination
- mobile polling
- admin polling
- Firestore vs PostgreSQL data duplication
- large JSON responses
- repeated settings retrieval
- ride/history queries
- notification queries
- feedback queries
- driver/passenger lists
- unnecessary database-to-server transfers

Prefer reducing transferred data rather than merely reducing query count.

DO NOT compromise correctness or security to reduce egress.

DO NOT migrate databases in Phase 2.7.

DO NOT replace Supabase yet.

DO NOT make destructive schema changes.

Use:

- selective columns
- server-side pagination
- appropriate filtering
- bounded result sets
- caching where safe
- request deduplication
- targeted refresh
- conditional polling
- response minimization
- indexes where they improve query efficiency
- existing application cache mechanisms

Measure before and after wherever possible.

Never claim an egress reduction without evidence.

---

# PHASE 2 SCOPE

ONLY work on:

- Phase 2.1 verification
- Phase 2.2 verification
- Phase 2.3
- Phase 2.4
- Phase 2.5
- Phase 2.6
- Phase 2.7

Do NOT start Phase 3.

---

# FROZEN / OUT OF SCOPE

Do NOT implement:

- Multi-stop rides
- Scheduled rides
- Wallet
- New payment gateway
- Major mobile redesign
- Website redesign
- New ride architecture
- React Native upgrade
- Expo upgrade
- Firebase upgrade
- Admin dependency upgrades
- Database migration
- Database replacement
- Unrelated refactoring

---

# SAFETY RULES

Before changing anything:

1. Inspect the current implementation.
2. Check git diff/status.
3. Understand existing behavior.
4. Determine whether the feature is already implemented.
5. Reuse existing architecture.
6. Make the smallest safe change.
7. Build/test after changes.

Never assume an audit document perfectly represents the current repository.

The CURRENT REPOSITORY is the final source of truth.

If an audit says something is missing but the repository already implements it, verify it rather than rewriting it.

---

# GIT SAFETY

Do not reset or discard existing user changes.

Do not use destructive git commands.

Do not force-push.

Before major changes, inspect:

git status
git diff
git log --oneline -10

Keep changes attributable to the current phase.

---

# TESTING REQUIREMENTS

After relevant changes:

Mobile:

npx tsc --noEmit

Server:

cd server
npm run build

Admin:

cd admin-portal
npm run build

For each Phase 2 feature, perform actual functional/API testing where possible.

Do not claim VERIFIED unless actually tested.

Use these statuses:

VERIFIED
PARTIALLY VERIFIED
NOT VERIFIED
FAILED

---

# IMPORTANT AGENT BEHAVIOR

Do not ask for permission for every small implementation step.

First analyze the repository and produce a concise implementation status.

Then implement only the currently authorized Phase 2 work.

If something is ambiguous or potentially destructive, STOP and report it instead of guessing.

At the end of Phase 2:

STOP.

Do not begin Phase 3 automatically.