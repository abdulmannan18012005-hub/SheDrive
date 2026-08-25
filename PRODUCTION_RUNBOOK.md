# SheDrive — Production Operations & Release Runbook

Version: 1.0.0 (Production Release)  
Platform: SheDrive / Lahore Pink Rides  
Live API: `https://shedrive.onrender.com/api/v1`

---

## 1. Production Architecture Overview

```
[ Mobile Apps (React Native / Expo) ]   [ Public Website (HTML5/JS) ]   [ Admin Portal (React / Vite) ]
                     \                         |                         /
                      \                        |                        /
                       \                       |                       /
                        v                      v                      v
                             [ Render Web Service (Node.js API) ]
                                 |                          |
                                 v                          v
                   [ Supabase PostgreSQL DB ]     [ Firebase Admin FCM / Cloudinary ]
```

- **Backend API**: Hosted on Render (`https://shedrive.onrender.com`).
- **Database Engine**: PostgreSQL on Supabase with automatic connection pooling and HTTP query proxy fallback.
- **Real-Time Layer**: Firestore (chat/emergency alerts) + Socket.io (driver bid negotiation).
- **Push Notifications**: Firebase Cloud Messaging (FCM) with Android channels (`rideAlerts`, `chatMessages`, `safetyAlerts`).
- **Digital Payments**: JazzCash & Easypaisa sandbox/production gateways + Cash settlement.

---

## 2. Production Environment Variables Checklist

Set these variables in the **Render Dashboard → Environment Variables**:

| Variable | Recommended Production Value | Sensitive |
|---|---|---|
| `NODE_ENV` | `production` | No |
| `PORT` | `3000` | No |
| `DATABASE_URL` | `postgresql://postgres:...@...:5432/postgres?sslmode=require` | **YES** |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | `<supabase-service-role-key>` | **YES** |
| `JWT_SECRET` | 32+ character high-entropy random string | **YES** |
| `CLOUDINARY_CLOUD_NAME` | `<cloudinary-cloud-name>` | No |
| `CLOUDINARY_API_KEY` | `<cloudinary-api-key>` | No |
| `CLOUDINARY_API_SECRET` | `<cloudinary-api-secret>` | **YES** |
| `GMAIL_USER` | `<gmail-address-for-otp>` | No |
| `GMAIL_APP_PASSWORD` | `<16-char-google-app-password>` | **YES** |
| `FIREBASE_PROJECT_ID` | `<firebase-project-id>` | No |
| `FIREBASE_CLIENT_EMAIL` | `<firebase-service-account-email>` | No |
| `FIREBASE_PRIVATE_KEY` | `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"` | **YES** |
| `JAZZCASH_ENV` | `production` (or `sandbox`) | No |
| `JAZZCASH_MERCHANT_ID` | `<merchant-id>` | No |
| `JAZZCASH_PASSWORD` | `<merchant-password>` | **YES** |
| `JAZZCASH_INTEGRITY_SALT` | `<integrity-salt>` | **YES** |
| `JAZZCASH_RETURN_URL` | `https://shedrive.onrender.com/api/v1/payments/callbacks/jazzcash` | No |
| `EASYPAISA_ENV` | `production` (or `sandbox`) | No |
| `EASYPAISA_STORE_ID` | `<store-id>` | No |
| `EASYPAISA_SECRET_KEY` | `<store-secret-hash>` | **YES** |
| `EASYPAISA_RETURN_URL` | `https://shedrive.onrender.com/api/v1/payments/callbacks/easypaisa` | No |

---

## 3. Database Backup & Disaster Recovery

### Automated Backups
Supabase performs automated daily backups. For Point-in-Time Recovery (PITR), enable it under Supabase Database settings.

### Manual Backup (CLI)
Run this command from any machine with `pg_dump` installed:
```bash
pg_dump -h <SUPABASE_DB_HOST> -p 5432 -U postgres -d postgres -F c -b -v -f shedrive_backup_$(date +%Y%m%d_%H%M%S).dump
```

### Disaster Restoration
To restore a snapshot into PostgreSQL:
```bash
pg_restore -h <SUPABASE_DB_HOST> -p 5432 -U postgres -d postgres -v -c shedrive_backup_<timestamp>.dump
```

---

## 4. Health Monitoring & Observability

- **Public Uptime Health Check**: `GET https://shedrive.onrender.com/api/v1/health`  
  - Target response: HTTP `200 OK`
  - Connect this endpoint to UptimeRobot, Pingdom, or BetterStack for 24/7 uptime alerting.
- **Deep System Diagnostics**: `GET https://shedrive.onrender.com/api/v1/admin/system/health-deep`  
  - Requires Admin Bearer Token.
  - Returns database connection latency, query timing, process memory footprint (RSS/heap), and server uptime.
- **Security Headers Verification**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

## 5. Multi-Tier Rollback Procedures

### Backend Rollback
- **Render Dashboard**: Go to Web Service $\to$ **Deploys** $\to$ Select the previous working commit $\to$ Click **Rollback to this deploy**.
- **Git Rollback**:
  ```bash
  git revert HEAD
  git push origin main
  ```

### Admin Portal Rollback
- Build previous commit: `cd admin-portal && npm run build` $\to$ upload resulting `dist/` bundle.

### Mobile App Rollback
- If utilizing Expo EAS Update: `eas update:rollback --channel production`.
- If distributed as APK/AAB: Increment version number and distribute the previous stable binary.

---

## 6. Release Verification Checklist

- [x] Mobile TypeScript compilation: `npx tsc --noEmit` (PASS)
- [x] Backend server build: `npm run build` in `server/` (PASS)
- [x] Admin Portal build: `npm run build` in `admin-portal/` (PASS)
- [x] Automated test suite: `19/19` tests passed (100%)
- [x] Live Render production probe: HTTP 200 on `/health` (PASS)
- [x] Live Auth gating: HTTP 401 on protected endpoints (PASS)
- [x] Public website pages: All 11 pages responsive and linked (PASS)
- [x] Global error boundary active on mobile (PASS)
