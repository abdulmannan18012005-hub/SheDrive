# SheDrive — Product Requirements Document (PRD)

**Status:** Pre-development baseline  
**Product:** SheDrive — female-only ride-hailing platform  
**Primary market:** Lahore, Pakistan

## 1. What to Build
A production-ready, safety-first ride-hailing ecosystem for female passengers and female drivers, with:
- React Native mobile app
- Backend REST API and real-time services
- PostgreSQL/Supabase database
- Firebase/Firestore where appropriate
- Admin portal
- Official website
- Public ride-sharing/tracking page

The product should use original SheDrive branding, workflows and UI rather than copying another service.

## 2. Target Users
### Female Passengers
Secure registration, ride booking, destination search, fare negotiation where supported, driver tracking, chat/call, SOS, ride sharing, history, receipts, ratings, settings and support.

### Female Drivers
Registration, identity/document verification, online/offline mode, ride offers, accept/counter, navigation, active-ride management, completion, earnings/platform-fee information, vehicle/profile management and support.

### Administrators
Secure authentication, driver verification, passenger/driver moderation, live ride monitoring, safety operations, platform-fee/payment review, fare/settings management, feedback/support and audit functions.

## 3. Core Features
- Login, signup, logout, OTP verification, forgot/reset password
- Female-only eligibility and driver verification
- Passenger booking and driver dispatch
- Google Maps/Places integration where configured
- GPS and real-time driver tracking
- Fare calculation and approved fare-bidding workflow
- In-ride chat/call
- SOS and Pakistan emergency handling
- Ride sharing
- Push notifications, including background/minimized delivery
- Profiles, saved places, history, receipts and ratings
- Notifications, settings, terms, privacy, user agreement and support
- Cash/direct-bank settlement as approved
- Driver monthly platform-fee workflow
- Admin dashboard, verification, moderation, rides, payments, settings and audit logs
- Professional responsive website

## Non-Functional Requirements
- Production-quality UX and accessibility
- Secure authentication, authorization and validation
- Server-authoritative ride/payment/business rules
- Loading, empty, success, error and retry states
- No hardcoded secrets
- No secrets committed to Git
- Reliable real-device testing
- Good API/database/admin performance
- No unnecessary dependency changes
- Release build must succeed
- No placeholder/mock production paths
