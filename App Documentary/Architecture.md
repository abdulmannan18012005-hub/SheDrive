# SheDrive — Architecture

## 1. App Flow and Architecture

```text
Passenger/Driver Mobile App
        |
        +--> HTTPS REST --> Backend API --> PostgreSQL/Supabase
        |                         |
        |                         +--> Auth/RBAC
        |                         +--> Ride lifecycle
        |                         +--> Admin operations
        |                         +--> Payments/support
        |
        +--> Firebase/Firestore --> real-time rides/location/chat where approved
        +--> Google Maps/Places
        +--> Device GPS
        +--> Push Notifications

Official Website --> Public/approved API endpoints
Admin Portal -----> Secure Admin API --> Backend
Public Tracking --> Token-protected tracking endpoint
```

### Authentication
Launch → session check → login/register → credential validation → OTP where required → token/session → role resolution → passenger/driver home.

### Passenger Ride State
`idle → searching → driver_offer → driver_selected → driver_arriving → driver_arrived → in_progress → completed → rated`

### Driver Ride State
`offline → online → request_received → accepted/countered → navigating_to_pickup → arrived → in_progress → completed → available/offline`

Ride transitions must be validated server-side.

### Admin Flow
`Admin Login → Dashboard → Module → Read/Search → Authorized Action → Database/API → Audit Log → UI Refresh`

## 2. Folder and File Structure

Adapt to the existing repository rather than blindly recreating files.

```text
SheDrive/
├── App.tsx
├── app.json
├── package.json
├── tsconfig.json
├── src/
│   ├── components/
│   ├── context/
│   ├── hooks/
│   ├── navigation/
│   ├── screens/
│   │   ├── passenger/
│   │   ├── driver/
│   │   └── shared/
│   ├── services/
│   ├── utils/
│   ├── types/
│   ├── constants/
│   ├── assets/
│   └── config/
├── android/
├── server/src/
├── admin-portal/src/
├── SheDrive Website/
├── UI Templates/
└── App Documentary/
```

## 3. Tech and Stack
### Mobile
React Native, Expo/Expo Prebuild as established, TypeScript, existing approved dependencies, Android native build, Google Maps SDK for Android, Google Places API (New), device location, Firebase services where already established.

### Backend
Node.js, TypeScript, Express/API framework already established, REST, Socket.io where established, JWT, bcrypt, PostgreSQL/Supabase, Firebase/Firestore where approved.

### Admin
Existing React admin portal, existing language/tooling, REST API, RBAC, search/filter/pagination.

### Website
Existing HTML/CSS/JavaScript stack unless migration is explicitly approved.

## Architecture Rules
- Mobile UI never performs privileged database operations directly.
- Admin actions always pass backend authorization.
- Critical business rules remain server-authoritative.
- Payment and ride states are server-authoritative.
- External services have timeout/error handling.
- Sensitive documents are never unnecessarily public.
