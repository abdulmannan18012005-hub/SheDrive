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

## PHASE 2 COMPLETION SUMMARY

- Commit: 723e40cb
- Phase 2 implementation: COMPLETE (all of 2.1 – 2.7)
- Local build results: Mobile tsc PASS / Server build PASS / Admin build PASS
- Production endpoint probes (local built server): health 200; login 400; admin/audit-logs 401; unread-count 401; rides/:id/chat-notify 401; PUT /user/saved-places/:id 401; OTP 6th request 429
- Phase 0 regression: previously verified; current-session rerun UNAVAILABLE (original Phase 0 test harness not present in repository)
- Phase 1 23/23 suite: previously verified; current-session rerun UNAVAILABLE (original test harness not present in repository — no test/ or e2e files outside node_modules, no test script in package.json). Phase 1 functionality (admin login/approve/reject/block/unblock, settings, payments, CORS, JWT, mobile auth) untouched by Phase 2 and builds pass.
- Remaining environmental verification (not code blockers): live FCM delivery (needs production FIREBASE_* creds), live SMTP/OTP email (needs Gmail creds), live Supabase billing-level egress measurement (needs Supabase telemetry), and re-run of the Phase 1 23/23 + Phase 0 suites after the harness is restored.
- NO critical unresolved issue. Safe to proceed only after production deploy + the above environmental checks.

## Phase 2.1 — Notification Center

STATUS: COMPLETED (commit 723e40cb)

- NotificationCenterScreen registered in PassengerStack and DriverStack
- Notifications entry added to SideDrawer
- PassengerHomeScreen and DriverHomeScreen notification bell buttons navigate to NotificationCenter
- Unread-count badge implemented on both home bells (red badge, fetched from GET /api/v1/user/notifications/unread-count; refreshes on screen focus)
- Backend: GET /api/v1/user/notifications (list), GET /api/v1/user/notifications/unread-count, PUT /api/v1/user/notifications/:id/read (mark one or 'all')
- NotificationCenter supports category filter, mark-all-read, unread dot
- Existing notification APIs reused (no duplicate)
- API prefix verified: getApiBaseUrl() resolves to .../api/v1
- Verification: mobile tsc PASS; endpoint probes 401 (auth-gated) PASS

---

## Phase 2.2 — Saved Places

STATUS: COMPLETED (commit 723e40cb)

- SavedPlacesScreen provides full CRUD (create/update/delete) with Home/Work label exclusivity
- SearchScreen fetches saved places and renders a Home/Work quick-select section; selecting a place fills pickup/destination; route calculation reuses existing getRoute (OSRM)
- Backend: GET/POST/DELETE /api/v1/saved-places already existed; added PUT /api/v1/saved-places/:id
- Backend alias added: app.use('/api/v1/user/saved-places', savedPlacesRoutes) — matches mobile path /user/saved-places
- No duplicate/conflicting route mount (distinct paths from /api/v1/saved-places)
- Verification: PUT route 401 (auth-gated) PASS; no route conflict

---

## Phase 2.3 — Chat Push Notifications

STATUS: COMPLETED — CODE VERIFIED; LIVE FCM DELIVERY NOT VERIFIED (no Firebase Admin creds in this environment)

- Backend: POST /api/v1/rides/:id/chat-notify (authenticateToken + ride participant check)
  - 401 if not authenticated
  - 403 if sender is not passenger_id or driver_id
  - 404 if ride missing
  - identifies opposite participant (driver<->passenger)
  - calls existing sendPushNotification (Firebase Admin); returns 200 even on FCM failure so chat is never blocked
  - sendPushNotification safely handles missing/expired tokens (clears stale token)
- ChatScreen writes the Firestore message, then fires chat-notify with Bearer token and the correct rideId from route.params
- Authorization verified by code + live probe (401 without token)
- LIVE FCM DELIVERY: NOT VERIFIED (requires production FIREBASE_* credentials)

---

## PHASE 2.4 — Trip Receipts

STATUS: COMPLETED (commit 723e40cb)

- Reusable TripReceiptModal (src/components/TripReceiptModal.tsx) displays: status, ride ID, date/time, pickup/dropoff, distance, duration, vehicle category, fare breakdown (initial bid / final fare), driver/passenger info per role, vehicle plate, payment status
- Passenger RideHistoryScreen cards are tappable (TouchableOpacity) and open the modal
- Driver RideHistoryScreen cards already tappable and open the modal
- Uses only existing RideRequest fields; no schema change; no invented fare components
- Verification: mobile tsc PASS (modal previously had compile errors — fixed); both history screens open modal

---

## PHASE 2.5 — Backend Security Hardening

STATUS: COMPLETED (commit 723e40cb)

- In-memory rate limiter (server/src/middleware/rateLimiter.ts); no new dependency
- Applied:
  - loginRateLimiter (20 requests / 5 min / IP) -> POST /api/v1/auth/login
  - otpRateLimiter (5 requests / 5 min / email) -> POST /api/v1/auth/send-registration-otp
  - passwordResetRateLimiter (3 requests / 15 min / email) -> POST /api/v1/auth/forgot-password
- Thresholds conservative; returns HTTP 429 with Retry-After when exceeded
- Valid requests unaffected before threshold
- Existing auth status codes/contracts preserved (400/401/403 unchanged)
- Fixed duplicate `export default router` in auth.routes.ts (was breaking server build)
- No authentication bypass introduced
- LIMITATION: in-memory/per-instance only (not distributed); resets on restart; not shared across Render instances. Acceptable for Phase 2.
- Verification: live probe — 6th OTP request returned 429; login still returns 400 (handler reachable)

---

## PHASE 2.6 — Admin Audit Logs

STATUS: COMPLETED (commit 723e40cb)

- Backend: GET /api/v1/admin/audit-logs (authenticateToken + requireAdmin) with pagination (page/limit), search (action/details/admin email), action filter, JOIN users for admin identity, ORDER BY timestamp DESC
- adminApi.getAuditLogs() matches the backend contract (reuses existing adminApi + PaginationBar)
- Admin Portal Audit Logs tab renders table + PaginationBar + filter/search UI
- Fixed undefined getActionColor (was causing runtime ReferenceError on the Audit tab) — added module-level helper in App.jsx
- Existing audit writes already present (APPROVE_DRIVER, REJECT_DRIVER, BLOCK_DRIVER/UNBLOCK_DRIVER, BLOCK_PASSENGER/UNBLOCK_PASSENGER) and are read by the new endpoint
- Existing admin functionality (approve/reject/block/unblock, settings, payments) untouched
- Verification: admin build PASS; audit endpoint 401 (auth+admin gated) PASS; getActionColor defined (no ReferenceError)

---

# PHASE 2.7 — SUPABASE EGRESS OPTIMIZATION

STATUS: COMPLETED (commit 723e40cb) — QUERY/RESPONSE-SIZE OPTIMIZATION VERIFIED; BILLING-LEVEL EGRESS REDUCTION NOT MEASURED

Changes in server/src/config/db.ts (Supabase-HTTP fallback shim — only used when TCP PostgreSQL is unavailable; production uses the TCP pool first):

Explicit-column selects introduced (no consumer field removed):
- monthly_payments aggregate: * -> platform_fee, status
- drivers JOIN roster (users): * -> id,name,phone,email,cnic,cnic_front_url,cnic_back_url,date_of_birth,verification_status,is_verified,is_blocked
- drivers JOIN roster (drivers): * -> driver_id,vehicle_category,vehicle_make,vehicle_model,vehicle_plate,vehicle_color,vehicle_year,ac_option,license_front_url,license_back_url,selfie_url,vehicle_photo_url,is_online,is_available,is_active,rating,total_rides,is_fee_suspended
- passenger roster: * -> id,name,phone,email,cnic,is_verified,is_blocked,created_at
- saved_places: * -> id,label,name,latitude,longitude,created_at
- user_notifications: * -> id,title,message,category,is_read,created_at
- drivers head count: * -> driver_id (head:true, no rows)

select('*') intentionally RETAINED where the response contract requires full rows:
- generic users/login (password_hash + profile fields required for auth)
- generic drivers (driver-profile responses)
- rides live monitor (admin live monitor spreads full ride)
- generic rides (ride detail / active ride)
- monthly_payments JOIN roster (spreads full payment)
- generic monthly_payments (driver payment info)
- admin_settings (single, tiny)
- emergency_contacts, support_reports

No new high-volume select('*') was introduced by Phase 2 (only existing queries were refined).

EGRESS RESULT DISTINCTION:
- Query/response-size optimization: VERIFIED (explicit columns reduce transferred fields for the 7 queries above).
- Actual Supabase billing-level egress reduction: NOT MEASURED (no Supabase usage telemetry available in this environment).

Supabase grace/bonus period runs until September 21. During Phase 2.7 NO migration, NO plan change, NO destructive schema change, and NO new database was performed. No indexes were added (none required by the implemented queries).

---

# PHASE 3 — COMPLETED

Phase 3 objective:

DRIVER DISPATCH AND ACTIVE RIDE LIFECYCLE SYNCHRONIZATION.

Status: COMPLETED

Commit: c38832e0

Implemented:
- Ride request ID synchronization between Firestore/mobile and PostgreSQL (POST /api/v1/rides/request accepts client rideId).
- Server-authoritative ride lifecycle status endpoint (PUT /api/v1/rides/:id/status) with participant authorization.
- State progression synchronization: requested -> negotiating -> accepted -> arrived -> in_progress/enroute -> completed -> cancelled.
- Normalization of 'enroute' and 'in_progress' states across PostgreSQL, active ride lookup, types, and admin live monitor.
- External Google Maps turn-by-turn navigation launcher on Driver ActiveRideScreen (with dynamic pickup/destination targets).
- Post-trip rating synchronization and aggregate score / total_rides recalculation (POST /api/v1/rides/:id/rating).
- Explicit column selections on active ride and driver queries preserving Supabase egress constraints.

Phase 3 verification:
- Mobile TypeScript (`npx tsc --noEmit`): PASS
- Server build (`npm run build`): PASS
- Admin Portal build (`npm run build`): PASS
- Contract & auth gating probes: PASS (401 without auth, 200 on health)
- Verification limitation: Full authenticated end-to-end business-flow testing requires valid live production credentials.

---

# PHASE 4 — COMPLETED

Phase 4 objective:

SAFETY, IN-RIDE COMMUNICATION, EMERGENCY SOS, GPS TRACKING, AND NOTIFICATION INFRASTRUCTURE.

Status: COMPLETED

Implemented:
- PostgreSQL SOS persistence table `sos_alerts` (010_phase4_sos_alerts.sql) with user details, coordinates, rideId, status, and timestamps.
- Backend emergency SOS endpoint (`POST /api/v1/safety/sos`) with Bearer token authentication and SOS rate limiting (`sosRateLimiter`: max 5 requests / 5 min).
- Admin emergency SOS retrieval (`GET /api/v1/safety/sos/recent`) and resolution (`PUT /api/v1/safety/sos/:id/resolve`) with strict admin authorization (`requireAdmin`).
- Mobile SOS unification in `src/utils/safety.ts` calling backend API with Bearer token in parallel with Firestore `/emergency_alerts` logging and phone dialer (15) trigger.
- Mobile Driver `ActiveRideScreen.tsx` and Passenger `RideTrackingScreen.tsx` updated to pass user auth token to `triggerEmergencySOS`.
- Public ride tracking rate limiter (`trackRateLimiter`: max 100 requests / hour / IP) applied to `GET /api/v1/rides/track/:shareToken`.
- Passenger live-ride sharing UI in `RideTrackingScreen.tsx` using `POST /api/v1/rides/share` and native OS share dialog (`Share.share`).
- Admin Portal SOS alerts management tab in `admin-portal/src/App.jsx` with real-time alert listing, active alert highlighting, and 1-click incident resolution via `adminApi.resolveSOSAlert`.
- Expo configuration (`app.json`) updated with background location permissions (`ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`) and Android notification channels (`rideAlerts`, `chatMessages`, `safetyAlerts`).
- Universal database engine (`server/src/config/db.ts`) updated to support `sos_alerts` in both TCP PostgreSQL and Supabase HTTP fallback modes with explicit column selections.

Phase 4 verification:
- Mobile TypeScript (`npx tsc --noEmit`): PASS
- Server build (`npm run build`): PASS
- Admin Portal build (`npm run build`): PASS
- 12/12 API & security probe suite: PASS (health 200, auth gating 401, missing token 404, rate limiter 429)
- Database schema: `sos_alerts` table verified in PostgreSQL / Supabase
- Environmental verification limitations: Live background push delivery on physical hardware requires active FCM production credentials and real Android/iOS device testing. Background location tracking requires a standalone APK build with runtime OS permissions.

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

---

# GIT SAFETY

Do not reset or discard existing user changes.

Do not use destructive git commands.

Do not force-push.

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

Use these statuses:
VERIFIED
PARTIALLY VERIFIED
NOT VERIFIED
FAILED

---

# IMPORTANT AGENT BEHAVIOR

Do not start Phase 5 automatically without explicit user instructions.