# SheDrive Database Schema - Phase 3 Updates

This document outlines the database schema updates required for Phase 3 features.

## Overview
SheDrive uses Firebase Firestore as the primary database. The schema is designed to be normalized and avoid duplicate data.

## Collections

### 1. users
Stores user account information for both passengers and drivers.

**Existing Fields:**
- `uid` (string, required): Unique user identifier
- `email` (string, required): User email address
- `name` (string, required): Full name
- `phone` (string, required): Phone number
- `role` (string, required): 'passenger' or 'driver'
- `createdAt` (timestamp, required): Account creation timestamp
- `photoURL` (string, optional): Profile picture URL
- `isVerified` (boolean, optional): Account verification status
- `isBlocked` (boolean, optional): Account blocked status
- `acceptedTerms` (boolean, optional): Terms acceptance flag

**New Fields (Phase 3):**
- `gender` (string, optional): User gender ('Female' or 'Other')
- `notificationSettings` (object, optional): Notification preferences
  - `rideNotifications` (boolean): Enable ride-related notifications
  - `promotionalNotifications` (boolean): Enable promotional notifications
  - `platformNotifications` (boolean): Enable platform updates
  - `paymentNotifications` (boolean): Enable payment notifications
  - `emergencyNotifications` (boolean): Enable emergency notifications (always true)
- `language` (string, optional): Preferred language ('en' or 'ur')
- `isActive` (boolean, optional): Account active status (for soft delete)
- `deletionReason` (string, optional): Reason for account deletion
- `deletedAt` (timestamp, optional): Account deletion timestamp

### 2. drivers
Stores driver-specific information.

**Existing Fields:**
- `uid` (string, required): Reference to users.uid
- `name` (string, required): Driver name
- `phone` (string, required): Driver phone
- `rating` (number, optional): Driver rating (0-5)
- `totalRides` (number, optional): Total completed rides
- `isActive` (boolean, optional): Driver active status
- `vehicleInfo` (object, optional): Vehicle details
  - `make` (string): Vehicle make
  - `model` (string): Vehicle model
  - `year` (string): Vehicle year
  - `plate` (string): License plate
  - `color` (string): Vehicle color
  - `photoUrl` (string): Vehicle photo URL
- `licenseFrontUrl` (string, optional): Driving license front photo
- `licenseBackUrl` (string, optional): Driving license back photo
- `registrationUrl` (string, optional): Vehicle registration document
- `insuranceUrl` (string, optional): Insurance document
- `cnic` (string, optional): CNIC number
- `dateOfBirth` (string, optional): Date of birth

**New Fields (Phase 3):**
- `vehicleReviewStatus` (string, optional): Vehicle info review status ('pending', 'approved', 'rejected')
- `vehicleReviewSubmittedAt` (timestamp, optional): Vehicle review submission timestamp
- `vehicleReviewNotes` (string, optional): Admin review notes
- `documentExpiryDates` (object, optional): Document expiry tracking
  - `drivingLicenseExpiry` (timestamp): License expiry date
  - `vehicleRegistrationExpiry` (timestamp): Registration expiry date
  - `insuranceExpiry` (timestamp): Insurance expiry date
- `profileCompletion` (number, optional): Profile completion percentage (0-100)

### 3. saved_places
Stores user's saved locations.

**Fields:**
- `id` (string, required): Unique place identifier
- `userId` (string, required): Reference to users.uid
- `label` (string, required): Place label ('Home', 'Work', or custom)
- `name` (string, required): Place name
- `latitude` (number, required): Latitude coordinate
- `longitude` (number, required): Longitude coordinate
- `address` (string, optional): Formatted address
- `createdAt` (timestamp, required): Creation timestamp
- `updatedAt` (timestamp, optional): Last update timestamp

**Constraints:**
- Each user can have only one 'Home' and one 'Work' place
- Custom labels can be duplicated
- Maximum 5 saved places per user

### 4. emergency_contacts
Stores user's emergency contacts.

**Existing Fields:**
- `id` (string, required): Unique contact identifier
- `userId` (string, required): Reference to users.uid
- `name` (string, required): Contact name
- `phone` (string, required): Contact phone number
- `relationship` (string, required): Relationship to user
- `createdAt` (timestamp, required): Creation timestamp

**Constraints:**
- Maximum 5 emergency contacts per user

### 5. notifications
Stores user notifications.

**Existing Fields:**
- `id` (string, required): Unique notification identifier
- `userId` (string, required): Reference to users.uid
- `type` (string, required): Notification type
- `title` (string, required): Notification title
- `body` (string, required): Notification body
- `data` (object, optional): Additional notification data
- `isRead` (boolean, required): Read status
- `category` (string, optional): Notification category
- `createdAt` (timestamp, required): Creation timestamp

**New Categories (Phase 3):**
- `ride`: Ride-related notifications
- `promotional`: Promotional notifications
- `platform`: Platform updates
- `payment`: Payment notifications
- `emergency`: Emergency notifications
- `document_expiry`: Document expiry reminders

### 6. rides
Stores ride information.

**Existing Fields:**
- `id` (string, required): Unique ride identifier
- `passengerId` (string, required): Reference to users.uid (passenger)
- `driverId` (string, optional): Reference to users.uid (driver)
- `status` (string, required): Ride status
- `pickup` (object, required): Pickup location
- `destination` (object, required): Destination location
- `fare` (number, optional): Ride fare
- `vehicleCategory` (string, required): Vehicle category
- `createdAt` (timestamp, required): Creation timestamp
- `completedAt` (timestamp, optional): Completion timestamp

**No changes required for Phase 3**

### 7. login_attempts
Stores login attempt tracking for security.

**Fields:**
- `id` (string, required): Unique attempt identifier
- `email` (string, required): Email/phone used for login
- `attempts` (number, required): Number of failed attempts
- `lastAttemptTime` (timestamp, required): Last attempt timestamp
- `lockoutUntil` (timestamp, optional): Lockout expiry timestamp
- `consecutiveLockouts` (number, required): Number of consecutive lockouts
- `deviceId` (string, required): Device identifier

**Note:** This collection is managed by the loginSecurity utility and stored in AsyncStorage.

### 8. sessions
Stores active user sessions.

**Fields:**
- `id` (string, required): Unique session identifier
- `userId` (string, required): Reference to users.uid
- `token` (string, required): Authentication token
- `refreshToken` (string, optional): Refresh token
- `tokenExpiry` (timestamp, optional): Token expiry timestamp
- `deviceId` (string, required): Device identifier
- `lastActivity` (timestamp, required): Last activity timestamp
- `createdAt` (timestamp, required): Session creation timestamp

**Note:** This collection is managed by the sessionManager utility and stored in AsyncStorage.

## Indexes

### Recommended Firestore Indexes

1. **saved_places**
   - Composite index on `userId` + `label` (for uniqueness check)

2. **emergency_contacts**
   - Index on `userId` (for querying user's contacts)

3. **notifications**
   - Composite index on `userId` + `isRead` + `createdAt` (for notification list)
   - Composite index on `userId` + `category` (for category filtering)

4. **drivers**
   - Index on `isActive` (for finding active drivers)
   - Composite index on `vehicleReviewStatus` + `vehicleReviewSubmittedAt` (for admin review queue)

## Data Migration Notes

### Phase 3 Migration Steps

1. **Add new fields to users collection:**
   - Add `gender` field (nullable)
   - Add `notificationSettings` object with default values
   - Add `language` field with default value 'en'
   - Add `isActive` field with default value true for existing users

2. **Add new fields to drivers collection:**
   - Add `vehicleReviewStatus` field with default value 'approved' for existing verified drivers
   - Add `documentExpiryDates` object (nullable)
   - Calculate and add `profileCompletion` field based on existing data

3. **Create saved_places collection:**
   - No migration needed (new collection)

4. **Update notification categories:**
   - Existing notifications will remain as-is
   - New notifications will use the updated category system

## Security Considerations

1. **Firestore Security Rules:**
   - Users can only read/write their own documents
   - Drivers can only update their own vehicle info (requires admin review)
   - Admin role required for vehicle review approval

2. **Data Privacy:**
   - Sensitive data (phone, email) should be masked in logs
   - Deletion operation should be soft delete with 30-day retention
   - Document expiry dates should be encrypted at rest

## Performance Optimization

1. **Pagination:**
   - Implement cursor-based pagination for notifications
   - Limit saved places to 5 per user

2. **Caching:**
   - Cache notification settings locally
   - Cache saved places locally
   - Cache language preference locally

3. **Batch Operations:**
   - Use batch writes for updating multiple notification settings
   - Use batch writes for profile updates

## Backup and Recovery

1. **Regular Backups:**
   - Daily automated backups of all collections
   - Point-in-time recovery capability

2. **Data Retention:**
   - Soft-deleted accounts retained for 30 days
   - Login attempt data retained for 90 days
   - Session data retained for 7 days

## Future Considerations

1. **Scalability:**
   - Consider sharding for large collections
   - Implement read replicas for high-traffic queries

2. **Analytics:**
   - Add analytics collection for tracking feature usage
   - Track notification engagement rates

3. **Compliance:**
   - Implement GDPR compliance features
   - Add data export functionality
