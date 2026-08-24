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

# PHASE 5 — COMPLETED

Phase 5 objective:

COMPLETE PROFILES, HISTORY AND SUPPORT ECOSYSTEM FOR PRODUCTION READINESS.

Status: COMPLETED

Implemented:

1. Supabase egress optimization:
   - Replaced `SELECT *` with explicit column selection in GET /user/profile driver query (user.routes.ts).
   - Replaced inefficient unread-count query (fetched all rows, filtered in JS) with `SELECT COUNT(*) WHERE is_read = false`.
   - All remaining `SELECT *` queries verified as intentionally retained per Phase 2.7 documentation (admin login needing password_hash, auth login, single-row admin_settings, tiny vehicle lookup tables, monthly_payments needing full row).

2. Account deletion audit logging:
   - DELETE /api/v1/auth/delete-account now records ACCOUNT_DELETED audit log with user name/email/role before deletion.
   - Retrieves user info for audit trail before hard delete.
   - Sets driver offline before cascade deletion.
   - Returns 404 if account not found.

3. Account deactivation audit logging:
   - POST /api/v1/user/deactivate now records ACCOUNT_DEACTIVATED audit log before soft-delete.

4. Support ticket screenshot attachment:
   - POST /api/v1/support/tickets now accepts optional `screenshotUrl` parameter.
   - Persisted to `screenshot_url` column in support_tickets table (confirmed in live DB schema).

5. Preserved Phase 0–4 functionality:
   - All notification endpoints unchanged (Phase 2 notification center preserved).
   - Saved places CRUD with Home/Work exclusivity preserved (Phase 2.2).
   - Trip receipt modal preserved (Phase 2.4).
   - Rating synchronization preserved (Phase 3).
   - SOS endpoints preserved (Phase 4).
   - Driver document update preserved with role authorization.
   - Driver vehicle update preserved with admin re-review trigger.
   - Profile editing preserved with existing validation.
   - Emergency contacts preserved with max-5 limit and ownership enforcement.
   - All ownership/authorization checks verified (`AND user_id = $X` on all user-scoped operations).

6. Security verification:
   - All profile/support/account endpoints require JWT authentication (authenticateToken middleware).
   - User-scoped operations enforce ownership (user_id filter on all queries).
   - Driver document/vehicle endpoints enforce role === 'driver'.
   - CNIC/sensitive data not exposed through public APIs.
   - Account deletion/deactivation auditable via audit_logs table.
   - Support tickets scoped to authenticated user.
   - No password/token/credential leaks in responses.

Phase 5 verification:
- Mobile TypeScript (`npx tsc --noEmit`): PASS
- Server build (`npm run build`): PASS
- Admin Portal build (`npm run build`): PASS
- No database migration required (all columns confirmed present in live Supabase DB).
- Environmental verification limitations: Full authenticated business-flow testing requires valid production JWT credentials. Live Supabase egress measurement requires Supabase telemetry dashboard access.

---

# FEEDBACK SYSTEM STREAMLINING & DEDICATED WEBSITE FEATURE — COMPLETED

Status: COMPLETED

Implemented:
1. **Dedicated Website Feedback Page:**
   - Created `SheDrive Website/feedback.html` with interactive 1–5 star rating selector, category chips, multiline feedback message, optional contact inputs (Name, Email/Phone), client-side validation, and instant submission feedback.
   - Connected directly to existing backend `POST /api/v1/support/feedback`.
2. **Website Navigation & Footer Integration:**
   - Added `Feedback` navigation link in top navbar across all 10 website pages (`index.html`, `passenger.html`, `driver.html`, `safety.html`, `downloads.html`, `contact.html`, `privacy.html`, `terms.html`, `track.html`, `feedback.html`).
   - Added `Feedback & Suggestions` link in footer across all 10 website pages.
3. **Contact Page Streamlining:**
   - Removed duplicate embedded feedback form in `contact.html`.
   - Replaced with a professional Call-to-Action banner pointing to `feedback.html`.
4. **Mobile App Streamlining (Redundancy Removal):**
   - Established `SideDrawer.tsx` ("Share App Feedback") as the single primary global mobile feedback entry point.
   - Removed redundant feedback buttons and modals from `Passenger ProfileScreen.tsx`, `Driver ProfileScreen.tsx`, and `SettingsScreen.tsx`.
   - Connected `SideDrawer` `FeedbackModal` to pass active `authToken` from `AppContext` for automatic authenticated submitter recognition.
5. **Admin Portal & Backend Compatibility:**
   - Reused existing `POST /api/v1/support/feedback`, `GET /api/v1/support/feedback`, and `GET /api/v1/admin/feedback`.
   - Verified that both web guest submissions and mobile app submissions appear seamlessly in the existing Admin Portal Feedback tab.
   - Zero database migrations required (`feedbacks` table reused 100%).

Verification:
- Mobile TypeScript (`npx tsc --noEmit`): PASS
- Server build (`npm run build`): PASS
- Admin Portal build (`npm run build`): PASS
- Live API probe: `POST /api/v1/support/feedback` returned HTTP 201 with generated feedbackId.
- Validation probe: Empty comment correctly returned HTTP 400 Bad Request.
- Link verification: 10/10 website pages verified for valid navbar and footer links to `feedback.html`.

---

---

# PHASE 6 — COMPLETED

Phase 6 objective:

PAYMENTS, MONTHLY PLATFORM FEE SETTLEMENT, AND AUDITABLE FINANCIAL ARCHITECTURE.

Status: COMPLETED

Commit: ba2dc2a3

Implemented:
1. Dynamic Platform Fee Engine:
   - `payment.routes.ts` dynamically queries `commission_pct` from `admin_settings` in PostgreSQL rather than hardcoding 7%.
   - Platform fee calculation: `Math.round(totalEarnings * (commissionPct / 100) * 100) / 100`.
2. Case-Insensitive Duplicate Transaction ID Checking:
   - `POST /api/v1/payments/driver/submit` sanitizes and checks `UPPER(transaction_id)` to prevent duplicate bank receipt submissions across drivers.
3. Financial Audit Logging:
   - Admin approval/rejection decisions in `PUT /api/v1/payments/admin/payments/:id/review` write immutable `APPROVE_PAYMENT` or `REJECT_PAYMENT` records to `audit_logs`.
4. Automated Notification Dispatch:
   - Approving or rejecting a monthly payment immediately dispatches a push notification and writes to `user_notifications` for the driver.
5. Suspension Lifecycle Management:
   - Approving a payment immediately clears `is_fee_suspended = false` on `drivers` table, allowing drivers to go online without manual DB editing.
6. Cash & Bidding Preservation:
   - Passenger payments remain direct cash on completion; trip receipts and ride history display agreed final fare and cash payment method.
7. Zero Schema Migrations:
   - Reused existing `monthly_payments`, `rides`, and `admin_settings` tables in PostgreSQL / Supabase.

Phase 6 verification:
- Mobile TypeScript (`npx tsc --noEmit`): PASS
- Server build (`npm run build`): PASS
- Admin Portal build (`npm run build`): PASS
- Security & Auth Gating Probes: PASS (401 without auth, 403 on role violation, 200 on health)

---

# PHASE 7 — COMPLETED

Phase 7 objective:

EXPAND ADMIN PORTAL MANAGEMENT (SUPPORT TICKETS, RIDE HISTORY, DEACTIVATED ACCOUNTS, BROADCAST NOTIFICATIONS, DRIVER RE-REVIEW).

Status: COMPLETED

Commit: 96aaca98

Implemented:
1. **Support Tickets Management:**
   - Backend: `GET /api/v1/admin/support/tickets` (pagination, search by subject/user/email, status filter) & `PUT /api/v1/admin/support/tickets/:id/status` (status transition, audit logging, push + in-app notification to ticket owner upon resolution).
   - Admin Portal: Dedicated **🎫 Support Tickets** tab with status filter chips (`all`, `open`, `in_progress`, `resolved`), search, ticket list table, screenshot preview modal, inline status change dropdown, and pagination.
2. **Ride History & Analytics Archive:**
   - Backend: `GET /api/v1/admin/rides/history` (explicit SQL column projection, date range filter `startDate`/`endDate`, status filter `completed`/`cancelled`, search, pagination).
   - Admin Portal: Dedicated **📜 Ride History** tab with status filters, date pickers, searchable table, passenger/driver contact info, fare & payment method badges, and comprehensive ride details modal.
3. **Deactivated Account Management:**
   - Backend: `GET /api/v1/admin/users/deactivated` (lists inactive users with deactivation reason and timestamps) & `PUT /api/v1/admin/users/:id/reactivate` (restores account, sets driver offline initially, and logs `REACTIVATE_ACCOUNT` to `audit_logs`).
   - Admin Portal: Dedicated **🔒 Deactivated Accounts** tab with user search, reason display, and Reactivate Account button with confirmation dialog (`reactivateConfirmModal`).
4. **Admin Broadcast & User Notifications:**
   - Backend: `POST /api/v1/admin/notifications/send` (supports audience targets `all`, `drivers`, `passengers`, `specific`, batch dispatches FCM push alerts, writes to `user_notifications` table for in-app Notification Center, and logs `SEND_ADMIN_NOTIFICATION` to `audit_logs`).
   - Admin Portal: Dedicated **📢 Send Notifications** tab with audience radio selector, real-time live mobile push preview card, character counters, validation, and confirmation dialog.
5. **Driver Verification Re-review Center:**
   - Enhanced **🛡️ Verification Queue** with `All`, `🆕 New Applications`, and `🔄 Re-Review` filter pills and badges, making drivers who updated existing credentials immediately distinguishable.
6. **Security & Supabase Egress Hardening:**
   - All 6 endpoints gated with `authenticateToken` + `requireAdmin` (401 unauth, 403 non-admin).
   - Explicit column projections throughout to prevent Supabase egress spikes.
   - All state mutations write immutable audit trails to `audit_logs`.
   - Zero SQL migrations required (100% existing Supabase schema utilized).

Phase 7 verification:
- Mobile TypeScript (`npx tsc --noEmit`): PASS (0 errors)
- Server build (`npm run build`): PASS (0 errors)
- Admin Portal build (`npm run build`): PASS (0 errors)
- Local express route test suite: 6/6 PASS
- Live production endpoint probes (`https://shedrive.onrender.com/api/v1`): 10/10 PASS (health 200, auth gating 401 on all endpoints)

---

# PHASE 8 — COMPLETED

Phase 8 objective:

ADVANCED ANALYTICS, REPORTING & OPERATIONAL INTELLIGENCE.

Status: COMPLETED

Commit: 2e37dece

Implemented:
1. **Server-Authoritative Analytics Backend Engine:**
   - `server/src/routes/v1/analytics.routes.ts`:
     - `GET /api/v1/admin/analytics/overview`: Executive KPI cards, gross revenue, platform commission (dynamic from `admin_settings`), net driver earnings, completion rates, active fleet counts, previous period comparisons ($\Delta\%$), and time-series daily/weekly/monthly revenue and ride volume trend data.
     - `GET /api/v1/admin/analytics/revenue`: Vehicle tier revenue breakdown (Mini, Sedan, Bike, Comfort, Premium, Family) and monthly platform fee collection accounting.
     - `GET /api/v1/admin/analytics/rides`: 24-hour peak demand histogram (0–23h), ride status distributions, averages (distance, duration, fare), top route corridors, and cancellation reason analysis.
     - `GET /api/v1/admin/analytics/drivers`: Paginated & sortable driver performance leaderboard (completed rides, cancellation rate %, gross earnings, net payouts, ratings).
     - `GET /api/v1/admin/analytics/safety-support`: SOS incident metrics, average resolution duration in minutes, support ticket category distributions, and 1–5 star customer/driver rating analysis.
2. **RFC 4180 CSV Report Export Engine:**
   - `GET /api/v1/admin/analytics/export`: Downloads formatted CSV attachments for Financials, Rides, Drivers, and Safety/Support reports with CSV formula injection sanitization (`=`, `+`, `-`, `@`) and audit logging (`EXPORT_ANALYTICS_REPORT`).
3. **Zero-Dependency SVG Charting Suite:**
   - `admin-portal/src/components/analytics/SvgCharts.jsx`:
     - `SvgLineChart`: Smooth multi-series SVG line chart with dynamic scaling, gridlines, data points, hover tooltips, and legends.
     - `SvgBarChart`: Categorical and 24-hour demand histogram bar chart with value callouts.
     - `SvgDonutChart`: SVG stroke-dasharray donut chart with percentage labels and color legends.
     - `KpiDeltaCard`: Metric cards with period-over-period delta badges ($\uparrow +12.4\%$ / $\downarrow -3.2\%$).
4. **Admin Portal UI Integration:**
   - `admin-portal/src/components/analytics/AnalyticsTab.jsx`: Master view with 5 sub-tabs (Executive Overview, Financials & Revenue, Rides & Demand, Driver Performance, Safety & Support), printable summary stylesheet (`@media print`), and CSV export modal.
   - `admin-portal/src/components/analytics/DateRangeSelector.jsx`: Quick presets (Today, 7D, 30D, This Month, 90D, Custom) synchronized across analytics queries.
   - `admin-portal/src/App.jsx`: Dedicated **📈 Operational Intelligence** sidebar navigation button.
5. **Security & Supabase Egress Hardening:**
   - All analytics endpoints protected with `authenticateToken` + `requireAdmin` (401 unauth, 403 non-admin).
   - Server-side SQL aggregations prevent client-side raw data downloads, keeping network payloads $<5\text{ KB}$.
   - Sensitive credentials (passwords, CNIC, payment tokens) strictly excluded.
   - Zero SQL migrations required (100% existing Supabase schema utilized).

Phase 8 verification:
- Mobile TypeScript (`npx tsc --noEmit`): PASS (0 errors)
- Server build (`npm run build`): PASS (0 errors)
- Admin Portal build (`npm run build`): PASS (0 errors)
- Local express route test suite: 10/10 PASS
- Live production endpoint probes (`https://shedrive.onrender.com/api/v1`): 12/12 PASS (health 200, all analytics and admin endpoints protected with 401 unauth)

---

# PHASE 9 — COMPLETED

Phase 9 objective:

OPERATIONAL RELIABILITY, COMPLIANCE MONITORING, DISPUTE RESOLUTION & SYSTEM HEALTH.

Status: COMPLETED

Commit: 4b4eee1c

Implemented:
1. **Deep System Health & Diagnostics Engine:**
   - Backend: `GET /api/v1/admin/system/health-deep` (`authenticateToken` $\to$ `requireAdmin`), measuring DB latency safely with lightweight ping, memory utilization (`heapUsedMb`, `heapTotalMb`, `rssMb`), server uptime, and gateway readiness checks (Firebase FCM, Gmail SMTP, Cloudinary).
   - Admin Portal: Dedicated **🩺 System Health** tab (`SystemHealthTab.jsx`) with live diagnostics cards, latency health indicators, memory gauges, uptime counters, and one-click refresh.
2. **Driver Document Expiry & Compliance Monitoring:**
   - Backend: `server/src/routes/v1/compliance.routes.ts`:
     - `GET /api/v1/admin/compliance/expiries` (filter by `status`: `all`, `expired`, `expiring_soon`, pagination, joins `drivers`, `document_expiry_tracking`, and `users`).
     - `POST /api/v1/admin/compliance/scan` (batch scans active approved drivers, flags documents expired or expiring within 30 days, generates in-app `user_notifications` of category `document_expiry`, triggers FCM push reminders with 7-day duplicate suppression, and writes `SCAN_COMPLIANCE` to `audit_logs`).
   - Admin Portal: Dedicated **📋 Driver Compliance** tab (`ComplianceTab.jsx`) with document expiry table, days remaining indicators, and "Run Compliance Scan" trigger button.
3. **Ride Dispute & Fare Adjustment Workflow:**
   - Backend: `server/src/routes/v1/dispute.routes.ts`:
     - `GET /api/v1/admin/disputes` (paginated list of user complaints with ride details, fares, pickup/dropoff, and status filters: `pending`, `resolved`, `rejected`).
     - `PUT /api/v1/admin/disputes/:id/resolve` (atomic dispute transition, input validation, resolution notes, optional fare adjustment, automated in-app + push notification to complainant, and `RESOLVE_DISPUTE` audit logging).
   - Admin Portal: Dedicated **⚖️ Ride Disputes** tab (`DisputesTab.jsx`) with dispute review cards, action selector (Dismiss / Issue Warning / Fare Adjustment), and audit notes modal.
4. **Enhanced Emergency SOS Incident Investigation:**
   - Backend: `PUT /api/v1/safety/sos/:id/investigate` (`authenticateToken` $\to$ `requireAdmin`, validates severity `'low' | 'medium' | 'high' | 'critical'`, police involvement flag, case resolution notes, updates `sos_alerts`, and writes `INVESTIGATE_SOS_ALERT` to `audit_logs`).
   - Admin Portal: Enhanced SOS Alerts table with "🔍 Investigate" case modal capturing severity levels, police contact toggle, and detailed case notes.
5. **Policy Enforcement & Official User Warnings:**
   - Backend: `POST /api/v1/admin/users/:id/warn` (`authenticateToken` $\to$ `requireAdmin`, supports categories `'cancellation_rate'`, `'policy_violation'`, `'behavior'`, dispatches in-app `user_notifications` of category `'safety'`, sends FCM push alert, and logs `ISSUE_USER_WARNING` to `audit_logs`).
   - Admin Portal: Added "⚠️ Warn" action button across Approved Drivers and Passengers rosters with warning dispatch modal.
6. **Security & Zero Schema Migrations:**
   - 100% of Phase 9 endpoints strictly protected by `authenticateToken` + `requireAdmin`.
   - Parameterized SQL used exclusively across all queries.
   - Zero SQL migrations required (100% existing PostgreSQL / Supabase schema utilized).

Phase 9 verification:
- Mobile TypeScript (`npx tsc --noEmit`): PASS (0 errors)
- Server build (`npm run build`): PASS (0 errors)
- Admin Portal build (`npm run build`): PASS (0 errors)
- Local express route & security test suite: 19/19 PASS (health 200, 401 unauthenticated, 403 non-admin, 400 validation, 200 admin)
- Live production endpoint probes (`https://shedrive.onrender.com/api/v1`): 17/17 PASS (health 200, all Phase 9 and Phase 1-8 endpoints protected with 401 unauth)

---

# PHASE 10 — COMPLETED

Phase 10 objective:

MULTI-STOP RIDES, SCHEDULED BOOKINGS, DIGITAL WALLET INTEGRATION (JAZZCASH & EASYPAISA SANDBOX), ADMIN PASSENGER TRANSACTIONS & WEBSITE TRANSFORMATION.

Status: COMPLETED

Commit: 42a8bcd2

Implemented:

1. **Multi-Stop Intermediate Routing:**
   - Database: Created `ride_stops` table (`id`, `ride_id`, `stop_order`, `latitude`, `longitude`, `label`, `completed`, `completed_at`, `created_at`) with index `idx_ride_stops_ride_order`.
   - Backend: Extended `POST /api/v1/rides/request` to accept up to 3 intermediate waypoints. Added `PUT /api/v1/rides/:id/stops/:stopId/complete` allowing drivers/passengers to mark waypoints completed and receive next target coordinates.
   - Mobile: Added `getMultiStopRoute` in `src/services/osrm.ts` calling OSRM with semicolon-delimited coordinates. Enhanced `SearchScreen.tsx`, `FareBidScreen.tsx`, `ActiveRideScreen.tsx`, and `RideTrackingScreen.tsx` with intermediate stop addition, progressive completion, dynamic Google Maps navigation targeting, and multi-stop Leaflet map markers.

2. **Scheduled Rides Booking & Auto-Dispatcher:**
   - Database: Added `is_scheduled`, `scheduled_for`, `scheduled_dispatch_at` columns and `idx_rides_scheduled` index on `rides` table.
   - Backend: Added validation for scheduled rides (min 30 min to max 7 days in advance), `GET /api/v1/rides/scheduled` query, and an automated background runner running every 60 seconds that scans for rides within 20 minutes of departure and auto-transitions them to `negotiating` with driver push notifications.
   - Mobile: Added Advance Scheduling toggle in `FareBidScreen.tsx` (preset chips: +1h, +2h, +4h, tomorrow) and scheduled ride tracking indicators.

3. **Passenger Payment Architecture (Cash, JazzCash, Easypaisa):**
   - Database: Created `payment_transactions` table (`id`, `ride_id`, `user_id`, `provider`, `amount`, `currency`, `transaction_ref`, `idempotency_key`, `status`, `gateway_response`, `created_at`, `updated_at`) with provider and status check constraints.
   - Backend Gateway Abstraction (`server/src/services/payments/`):
     - `IPaymentGateway` interface (`initiatePayment`, `verifyPayment`, `handleWebhook`, `refundPayment`).
     - `CashGateway`: Instant settlement on arrival.
     - `JazzCashGateway`: HMAC-SHA256 signature generation and IPN verification with sandbox simulator.
     - `EasypaisaGateway`: SHA-256 checksum generation and MA push verification with sandbox simulator.
   - Endpoints:
     - `POST /api/v1/payments/passenger/initiate` (idempotency support, audit logging `INITIATE_PAYMENT`).
     - `GET /api/v1/payments/passenger/transactions/:id` (ownership authorization).
     - `POST /api/v1/payments/callbacks/jazzcash` & `POST /api/v1/payments/callbacks/easypaisa` (IPN callbacks).
     - `GET /api/v1/payments/admin/transactions` & `GET /api/v1/admin/payments/transactions` (admin audit log).

4. **Admin Portal Enhancements:**
   - Created `PassengerTransactionsTab.jsx` with provider filter (`all`, `cash`, `jazzcash`, `easypaisa`), status filter, search, amount formatting, and sandbox indicator badges.
   - Mounted `💳 Passenger Payments` sidebar navigation button.
   - Enhanced `selectedRideDetails` modal in `App.jsx` to render multi-stop waypoints (Stop #1, Stop #2) and scheduled departure banners.

5. **Public Website Transformation (11 Pages):**
   - Added modern feature sections highlighting Multi-Stop journeys, Advance Scheduling, and Cash/JazzCash/Easypaisa payments across `SheDrive Website/` (`index.html`, `passenger.html`, `driver.html`, `safety.html`, `downloads.html`, `contact.html`, `privacy.html`, `terms.html`, `track.html`, `feedback.html`).

Phase 10 verification:
- Mobile TypeScript (`npx tsc --noEmit`): PASS (0 errors)
- Server build (`npm run build`): PASS (0 errors)
- Admin Portal build (`npm run build`): PASS (0 errors)
- Local express route & security test suite: 12/12 PASS
- Database migration `012_phase10_multistop_scheduled_payments.sql`: APPLIED to PostgreSQL / Supabase

---

# PRODUCTION CREDENTIAL HANDOFF GUIDE (JAZZCASH & EASYPAISA)

When ready to switch from Sandbox to Live Production for digital payments, set the following environment variables in your server environment (e.g. Render Dashboard -> Environment Variables):

### 1. JazzCash Production Setup
- `JAZZCASH_ENV=production`
- `JAZZCASH_MERCHANT_ID=<Your_Live_Merchant_ID>`
- `JAZZCASH_PASSWORD=<Your_Live_Merchant_Password>`
- `JAZZCASH_INTEGRITY_SALT=<Your_Live_Integrity_Salt_Key>`
- `JAZZCASH_RETURN_URL=https://shedrive.onrender.com/api/v1/payments/callbacks/jazzcash`

### 2. Easypaisa Production Setup
- `EASYPAISA_ENV=production`
- `EASYPAISA_STORE_ID=<Your_Live_Store_ID>`
- `EASYPAISA_SECRET_KEY=<Your_Live_Store_Secret_Key_or_Hash>`
- `EASYPAISA_RETURN_URL=https://shedrive.onrender.com/api/v1/payments/callbacks/easypaisa`

Zero code modifications are required to go live — the backend `JazzCashGateway` and `EasypaisaGateway` automatically switch from sandbox mock signatures to production HMAC-SHA256 signature verification and API endpoints based on `JAZZCASH_ENV` and `EASYPAISA_ENV`.

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
`npx tsc --noEmit`

Server:
`cd server && npm run build`

Admin:
`cd admin-portal && npm run build`