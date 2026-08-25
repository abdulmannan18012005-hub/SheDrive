import { Router, Response } from 'express';
import { query } from '../../config/db';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { sendPushNotification, notifyNearbyDrivers } from '../../services/notificationService';
import { createRateLimiter, rideRequestRateLimiter } from '../../middleware/rateLimiter';

const router = Router();

// Rate limiter for public tracking endpoint (100 requests per hour per IP)
const trackRateLimiter = createRateLimiter(
  100, // 100 requests
  60 * 60 * 1000, // per hour
  (req) => req.ip || 'unknown'
);

/**
 * POST /api/v1/rides/calculate-fare
 * Body: { vehicleCategory, distanceKm, durationMin }
 * Description: Calculates fare based on category-specific pricing from admin settings
 */
router.post('/calculate-fare', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleCategory, distanceKm, durationMin } = req.body;

    if (!vehicleCategory || distanceKm === undefined || durationMin === undefined) {
      return res.status(400).json({ error: 'Missing fare calculation parameters' });
    }

    // Fetch category fares from admin settings
    const settingsResult = await query('SELECT category_fares FROM admin_settings WHERE id = 1');
    
    let categoryFares = [];
    if (settingsResult.rows.length > 0 && settingsResult.rows[0].category_fares) {
      try {
        categoryFares = typeof settingsResult.rows[0].category_fares === 'string'
          ? JSON.parse(settingsResult.rows[0].category_fares)
          : settingsResult.rows[0].category_fares;
      } catch (e) {
        categoryFares = [];
      }
    }

    // Find the requested category
    const category = categoryFares.find((cat: any) => cat.id === vehicleCategory);
    if (!category) {
      return res.status(400).json({ error: 'Invalid vehicle category' });
    }

    // Calculate fare: baseFare + (distance × perKmRate) + (duration × perMinuteRate)
    const baseFare = parseFloat(category.baseFare) || 0;
    const perKmRate = parseFloat(category.perKmRate) || 0;
    const perMinuteRate = parseFloat(category.perMinuteRate) || 0;
    const minimumFare = parseFloat(category.minimumFare) || 0;

    const distanceCharge = parseFloat(distanceKm) * perKmRate;
    const timeCharge = parseFloat(durationMin) * perMinuteRate;
    const calculatedFare = baseFare + distanceCharge + timeCharge;

    // Apply minimum fare
    const finalFare = calculatedFare < minimumFare ? minimumFare : calculatedFare;

    res.status(200).json({
      baseFare,
      perKmRate,
      perMinuteRate,
      minimumFare,
      distanceCharge,
      timeCharge,
      calculatedFare,
      finalFare,
    });
  } catch (error) {
    console.error('Calculate fare error:', error);
    res.status(500).json({ error: 'Failed to calculate fare' });
  }
});

// Create new ride request (supports multi-stop & scheduled bookings)
router.post('/request', authenticateToken, rideRequestRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const {
      rideId: clientRideId,
      vehicleCategory,
      pickup,
      destination,
      stops,
      distanceKm,
      durationMin,
      estimatedFare,
      offeredFare,
      polyline,
      paymentMethod,
      isScheduled,
      scheduledFor,
    } = req.body;

    const passengerId = req.user?.id;
    if (!passengerId || !pickup || !destination) {
      return res.status(400).json({ error: 'Missing ride parameters (pickup and destination are required)' });
    }

    if (pickup.latitude === undefined || pickup.longitude === undefined ||
        destination.latitude === undefined || destination.longitude === undefined) {
      return res.status(400).json({ error: 'Valid pickup and destination coordinates are required' });
    }

    const numDistance = Number(distanceKm);
    const numDuration = Number(durationMin);
    if ((distanceKm !== undefined && (isNaN(numDistance) || numDistance < 0)) ||
        (durationMin !== undefined && (isNaN(numDuration) || numDuration < 0))) {
      return res.status(400).json({ error: 'Distance and duration must be non-negative numbers' });
    }

    const rawEstimatedFare = Number(estimatedFare);
    const rawOfferedFare = Number(offeredFare);
    if ((estimatedFare !== undefined && (isNaN(rawEstimatedFare) || rawEstimatedFare < 50)) ||
        (offeredFare !== undefined && (isNaN(rawOfferedFare) || rawOfferedFare < 50))) {
      return res.status(400).json({ error: 'Minimum fare must be at least Rs. 50' });
    }

    const validatedEstimatedFare = Math.max(50, rawEstimatedFare || 50);
    const validatedOfferedFare = Math.max(50, rawOfferedFare || validatedEstimatedFare);

    const now = Date.now();

    // Validate scheduled ride parameters
    let isScheduledRide = Boolean(isScheduled);
    let scheduledForTimestamp: number | null = null;
    let initialStatus = 'requested';

    if (isScheduledRide) {
      if (!scheduledFor || isNaN(Number(scheduledFor))) {
        return res.status(400).json({ error: 'Valid future scheduledFor timestamp is required for scheduled rides' });
      }

      scheduledForTimestamp = Number(scheduledFor);
      const minAdvanceMs = 30 * 60 * 1000; // 30 mins
      const maxAdvanceMs = 7 * 24 * 60 * 60 * 1000; // 7 days

      if (scheduledForTimestamp < now + minAdvanceMs) {
        return res.status(400).json({ error: 'Scheduled ride must be booked at least 30 minutes in advance' });
      }

      if (scheduledForTimestamp > now + maxAdvanceMs) {
        return res.status(400).json({ error: 'Scheduled ride cannot be booked more than 7 days in advance' });
      }

      initialStatus = 'scheduled';
    }

    // Validate intermediate stops (maximum 3 intermediate stops)
    const validStops: Array<{ latitude: number; longitude: number; label: string; stopOrder: number }> = [];
    if (Array.isArray(stops) && stops.length > 0) {
      if (stops.length > 3) {
        return res.status(400).json({ error: 'Maximum 3 intermediate stops allowed per ride' });
      }

      for (let i = 0; i < stops.length; i++) {
        const s = stops[i];
        if (!s || typeof s.latitude !== 'number' || typeof s.longitude !== 'number') {
          return res.status(400).json({ error: `Invalid coordinates for stop #${i + 1}` });
        }
        validStops.push({
          latitude: s.latitude,
          longitude: s.longitude,
          label: s.label || `Intermediate Stop ${i + 1}`,
          stopOrder: i + 1,
        });
      }
    }

    const rideId = clientRideId && typeof clientRideId === 'string' && clientRideId.trim()
      ? clientRideId.trim()
      : `ride_${now}_${Math.random().toString(36).substring(2, 7)}`;

    // Check if clientRideId already exists for idempotency
    const existingRide = await query('SELECT ride_id, status FROM rides WHERE ride_id = $1', [rideId]);
    if (existingRide.rows.length > 0) {
      return res.status(200).json({
        success: true,
        rideId,
        status: existingRide.rows[0].status,
        isDuplicate: true,
      });
    }

    // 1. Insert ride record
    await query(
      `INSERT INTO rides (
        ride_id, passenger_id, status, vehicle_category,
        pickup_lat, pickup_lng, pickup_label,
        dropoff_lat, dropoff_lng, dropoff_label,
        distance_km, duration_min, estimated_fare, offered_fare, polyline,
        payment_method, is_scheduled, scheduled_for,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        rideId,
        passengerId,
        initialStatus,
        vehicleCategory || 'mini',
        pickup.latitude,
        pickup.longitude,
        pickup.label || '',
        destination.latitude,
        destination.longitude,
        destination.label || '',
        numDistance || 0,
        numDuration || 0,
        validatedEstimatedFare,
        validatedOfferedFare,
        polyline || '',
        paymentMethod || 'cash',
        isScheduledRide,
        scheduledForTimestamp,
        now,
        now,
      ]
    );

    // 2. Insert intermediate waypoints into ride_stops
    for (const stop of validStops) {
      const stopId = `stop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await query(
        `INSERT INTO ride_stops (id, ride_id, stop_order, latitude, longitude, label, completed, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, $7)`,
        [stopId, rideId, stop.stopOrder, stop.latitude, stop.longitude, stop.label, now]
      );
    }

    // 3. Dispatch push notifications to nearby online verified drivers only for immediate rides
    if (!isScheduledRide) {
      notifyNearbyDrivers(
        vehicleCategory || 'mini',
        pickup.label || 'Lahore Pickup',
        offeredFare || estimatedFare || 0,
        rideId
      ).catch((err: any) => console.warn('[FCM] Dispatch to drivers warning:', err));
    }

    res.status(201).json({
      rideId,
      passengerId,
      status: initialStatus,
      vehicleCategory,
      pickup,
      destination,
      stops: validStops,
      isScheduled: isScheduledRide,
      scheduledFor: scheduledForTimestamp,
      estimatedFare,
      offeredFare,
      paymentMethod: paymentMethod || 'cash',
    });
  } catch (error) {
    console.error('Create ride error:', error);
    res.status(500).json({ error: 'Failed to submit ride request' });
  }
});

/**
 * PUT /api/v1/rides/:id/status
 * Body: { status: string, driverId?: string, driverName?: string, driverPhone?: string, driverVehicle?: string, currentFare?: number }
 * Description: Updates ride status and associated driver details in PostgreSQL
 */
router.put('/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id: rideId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { status, driverId, driverName, driverPhone, driverVehicle, currentFare } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Verify ride exists and user has authorization
    const rideRes = await query(
      'SELECT ride_id, passenger_id, driver_id, status FROM rides WHERE ride_id = $1',
      [rideId]
    );

    if (rideRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const currentRide = rideRes.rows[0];
    const isParticipant = userId === currentRide.passenger_id || userId === currentRide.driver_id || userRole === 'admin' || (userRole === 'driver' && status === 'accepted');

    if (!isParticipant) {
      return res.status(403).json({ error: 'You are not authorized to update this ride' });
    }

    // Phase 11: Terminal State Protection
    if (currentRide.status === 'completed' || currentRide.status === 'cancelled') {
      return res.status(400).json({
        error: `Cannot update ride in a terminal state (${currentRide.status})`,
        currentStatus: currentRide.status,
      });
    }

    const now = Date.now();
    // Normalize 'enroute' or 'started' to 'in_progress' for database schema compatibility
    const normalizedStatus = (status === 'enroute' || status === 'started') ? 'in_progress' : status;

    // Phase 11: Authoritative State Machine Validation
    const VALID_TRANSITIONS: Record<string, string[]> = {
      requested: ['negotiating', 'accepted', 'cancelled'],
      scheduled: ['negotiating', 'accepted', 'cancelled'],
      negotiating: ['accepted', 'cancelled'],
      accepted: ['arrived', 'cancelled'],
      arrived: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
    };

    if (currentRide.status !== normalizedStatus && userRole !== 'admin') {
      const allowedNextStates = VALID_TRANSITIONS[currentRide.status] || [];
      if (!allowedNextStates.includes(normalizedStatus)) {
        return res.status(400).json({
          error: `Invalid ride status transition from '${currentRide.status}' to '${normalizedStatus}'`,
          currentStatus: currentRide.status,
          allowedTransitions: allowedNextStates,
        });
      }
    }

    if (normalizedStatus === 'accepted') {
      // Phase 11: Prevent Driver Ride Stealing / Overwrites
      if (currentRide.driver_id && currentRide.driver_id !== userId && userRole !== 'admin') {
        return res.status(409).json({ error: 'Ride has already been accepted by another driver' });
      }

      const assignedDriverId = driverId || userId;
      await query(
        `UPDATE rides SET
          status = 'accepted',
          driver_id = $1,
          final_fare = COALESCE($2, final_fare, offered_fare),
          updated_at = $3
         WHERE ride_id = $4`,
        [assignedDriverId, currentFare || null, now, rideId]
      );
    } else if (normalizedStatus === 'arrived') {
      await query(
        `UPDATE rides SET status = 'arrived', updated_at = $1 WHERE ride_id = $2`,
        [now, rideId]
      );
    } else if (normalizedStatus === 'in_progress') {
      await query(
        `UPDATE rides SET status = 'in_progress', ride_started_at = COALESCE(ride_started_at, $1), updated_at = $1 WHERE ride_id = $2`,
        [now, rideId]
      );
    } else if (normalizedStatus === 'completed') {
      await query(
        `UPDATE rides SET status = 'completed', final_fare = COALESCE($1, final_fare, offered_fare), updated_at = $2 WHERE ride_id = $3`,
        [currentFare || null, now, rideId]
      );

      // Increment driver total completed rides count
      const effectiveDriverId = currentRide.driver_id || driverId;
      if (effectiveDriverId) {
        await query(
          'UPDATE drivers SET total_rides = COALESCE(total_rides, 0) + 1 WHERE driver_id = $1',
          [effectiveDriverId]
        );
      }
    } else if (normalizedStatus === 'cancelled') {
      await query(
        `UPDATE rides SET status = 'cancelled', updated_at = $1 WHERE ride_id = $2`,
        [now, rideId]
      );

      // Phase 11: Synchronize ride cancellation with pending payment transactions
      await query(
        `UPDATE payment_transactions 
         SET status = 'failed', updated_at = $1 
         WHERE ride_id = $2 AND status IN ('pending', 'pending_user_auth')`,
        [now, rideId]
      );
    } else {
      await query(
        `UPDATE rides SET status = $1, updated_at = $2 WHERE ride_id = $3`,
        [normalizedStatus, now, rideId]
      );
    }

    res.status(200).json({
      success: true,
      rideId,
      status: normalizedStatus,
      updatedAt: now,
    });
  } catch (error) {
    console.error('Update ride status error:', error);
    res.status(500).json({ error: 'Failed to update ride status' });
  }
});

/**
 * POST /api/v1/rides/:id/rating
 * Body: { rating: number, comment?: string }
 * Description: Submits rating and review for a completed ride and updates driver aggregate score
 */
router.post('/:id/rating', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id: rideId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { rating, comment } = req.body;

    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    // Verify ride
    const rideRes = await query(
      'SELECT ride_id, passenger_id, driver_id, status FROM rides WHERE ride_id = $1',
      [rideId]
    );

    if (rideRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const ride = rideRes.rows[0];
    if (userId !== ride.passenger_id && userId !== ride.driver_id && userRole !== 'admin') {
      return res.status(403).json({ error: 'Only ride participants can submit ratings' });
    }

    if (ride.status !== 'completed') {
      return res.status(400).json({ error: 'Ratings can only be submitted for completed rides', currentStatus: ride.status });
    }

    const now = Date.now();
    const feedbackId = `fb_${now}_${Math.random().toString(36).substring(2, 6)}`;
    const targetDriverId = ride.driver_id;

    // Get user details
    const userRes = await query('SELECT name, phone, email FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0] || {};

    // Record in feedbacks table for admin moderation and historical review
    await query(
      `INSERT INTO feedbacks (id, user_id, user_name, user_phone, user_email, user_role, category, rating, comment, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'driver_rating', $7, $8, 'reviewed', $9)`,
      [
        feedbackId,
        userId,
        user.name || 'User',
        user.phone || '',
        user.email || '',
        userRole || 'passenger',
        ratingNum,
        comment ? comment.trim() : `Ride rating: ${ratingNum} stars`,
        now,
      ]
    );

    // If passenger is rating driver, recalculate driver average rating
    if (userRole === 'passenger' && targetDriverId) {
      const allRatingsRes = await query(
        `SELECT AVG(rating)::numeric(3,2) as avg_rating FROM feedbacks WHERE category = 'driver_rating' AND comment LIKE '%' || $1 || '%' OR user_id = $2`,
        [targetDriverId, userId]
      );
      if (allRatingsRes.rows.length > 0 && allRatingsRes.rows[0].avg_rating) {
        const newAvg = parseFloat(allRatingsRes.rows[0].avg_rating);
        await query('UPDATE drivers SET rating = $1 WHERE driver_id = $2', [newAvg, targetDriverId]);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Rating submitted successfully',
      rating: ratingNum,
    });
  } catch (error) {
    console.error('Submit ride rating error:', error);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// Fetch active ride for passenger or driver
router.get('/active', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    const column = role === 'driver' ? 'driver_id' : 'passenger_id';
    const result = await query(
      `SELECT ride_id, passenger_id, driver_id, status, vehicle_category,
              pickup_lat, pickup_lng, pickup_label,
              dropoff_lat, dropoff_lng, dropoff_label,
              distance_km, duration_min, estimated_fare, offered_fare, final_fare,
              polyline, created_at, updated_at
       FROM rides
       WHERE ${column} = $1 AND status IN ('requested', 'negotiating', 'accepted', 'arrived', 'in_progress', 'enroute')
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({ ride: null });
    }

    res.status(200).json({ ride: result.rows[0] });
  } catch (error) {
    console.error('Fetch active ride error:', error);
    res.status(500).json({ error: 'Failed to retrieve active ride' });
  }
});

/**
 * POST /api/v1/rides/share
 * Body: { rideId }
 * Description: Creates a share token for public ride tracking
 */
router.post('/share', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { rideId } = req.body;
    const userId = req.user?.id;

    if (!rideId) {
      return res.status(400).json({ error: 'Ride ID is required' });
    }

    // Verify user owns this ride (passenger or driver)
    const rideCheck = await query(
      `SELECT ride_id, passenger_id, driver_id FROM rides WHERE ride_id = $1`,
      [rideId]
    );

    if (rideCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const ride = rideCheck.rows[0];
    if (ride.passenger_id !== userId && ride.driver_id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to share this ride' });
    }

    // Check if share already exists and is not expired
    const existingShare = await query(
      `SELECT share_token, expires_at FROM ride_shares WHERE ride_id = $1 AND expires_at > $2 ORDER BY created_at DESC LIMIT 1`,
      [rideId, Date.now()]
    );

    if (existingShare.rows.length > 0) {
      return res.status(200).json({
        shareToken: existingShare.rows[0].share_token,
        expiresAt: existingShare.rows[0].expires_at,
        shareUrl: `https://shedrive.com/track/${existingShare.rows[0].share_token}`,
      });
    }

    // Generate new share token
    const shareToken = `share_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const shareId = `share_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now

    await query(
      `INSERT INTO ride_shares (id, ride_id, share_token, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [shareId, rideId, shareToken, expiresAt, Date.now()]
    );

    // Also update rides table for convenience
    await query(
      `UPDATE rides SET share_token = $1, share_expires_at = $2 WHERE ride_id = $3`,
      [shareToken, expiresAt, rideId]
    );

    res.status(201).json({
      shareToken,
      expiresAt,
      shareUrl: `https://shedrive.com/track/${shareToken}`,
    });
  } catch (error) {
    console.error('Create share error:', error);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

/**
 * GET /api/v1/rides/track/:shareToken
 * Description: Public endpoint to track a shared ride (no authentication required)
 */
router.get('/track/:shareToken', trackRateLimiter, async (req: any, res: Response) => {
  try {
    const { shareToken } = req.params;

    // Find the share record
    const shareResult = await query(
      `SELECT ride_id, expires_at FROM ride_shares WHERE share_token = $1 AND expires_at > $2`,
      [shareToken, Date.now()]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Share link not found or expired' });
    }

    const rideId = shareResult.rows[0].ride_id;

    // Fetch ride details
    const rideResult = await query(
      `SELECT 
        ride_id, status, pickup_lat, pickup_lng, pickup_label,
        dropoff_lat, dropoff_lng, dropoff_label, distance_km, duration_min,
        current_fare, driver_id, driver_name, driver_phone, driver_vehicle,
        polyline, driver_coords, updated_at
       FROM rides WHERE ride_id = $1`,
      [rideId]
    );

    if (rideResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const ride = rideResult.rows[0];

    // Return limited public information (no sensitive user data)
    res.status(200).json({
      rideId: ride.ride_id,
      status: ride.status,
      pickup: {
        latitude: ride.pickup_lat,
        longitude: ride.pickup_lng,
        label: ride.pickup_label,
      },
      dropoff: {
        latitude: ride.dropoff_lat,
        longitude: ride.dropoff_lng,
        label: ride.dropoff_label,
      },
      distanceKm: ride.distance_km,
      durationMin: ride.duration_min,
      currentFare: ride.current_fare,
      driverName: ride.driver_name || null,
      driverVehicle: ride.driver_vehicle || null,
      driverCoords: ride.driver_coords || null,
      polyline: ride.polyline || null,
      updatedAt: ride.updated_at,
    });
  } catch (error) {
    console.error('Track ride error:', error);
    res.status(500).json({ error: 'Failed to track ride' });
  }
});

/**
 * POST /api/v1/rides/:id/chat-notify
 * Description: Send FCM notification to the opposite participant when a chat message is sent
 */
router.post('/:id/chat-notify', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id: rideId } = req.params;
    const senderId = req.user?.id;

    if (!senderId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify the ride exists and the sender is a participant
    const rideResult = await query(
      `SELECT passenger_id, driver_id FROM rides WHERE ride_id = $1`,
      [rideId]
    );

    if (rideResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const { passenger_id, driver_id } = rideResult.rows[0];

    // Verify sender is either passenger or driver
    if (senderId !== passenger_id && senderId !== driver_id) {
      return res.status(403).json({ error: 'You are not a participant in this ride' });
    }

    // Identify the opposite participant
    const recipientId = senderId === passenger_id ? driver_id : passenger_id;

    if (!recipientId) {
      return res.status(400).json({ error: 'Opposite participant not found' });
    }

    // Send FCM notification to recipient
    const sent = await sendPushNotification({
      userId: recipientId,
      title: '💬 New Chat Message',
      body: 'You have a new message in your active ride chat.',
      data: {
        type: 'chat_message',
        rideId,
      },
    });

    if (sent) {
      res.status(200).json({ success: true, message: 'Chat notification sent' });
    } else {
      res.status(200).json({ success: false, message: 'Notification not sent (no FCM token)' });
    }
  } catch (error) {
    console.error('Chat notify error:', error);
    res.status(200).json({ success: false, message: 'Notification failed' });
  }
});

/**
 * GET /api/v1/rides/scheduled
 * Description: Fetches scheduled rides for the authenticated passenger, driver, or admin.
 */
router.get('/scheduled', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    let filterSql = 'WHERE r.is_scheduled = true';
    const params: any[] = [];

    if (role === 'passenger') {
      params.push(userId);
      filterSql += ` AND r.passenger_id = $${params.length}`;
    } else if (role === 'driver') {
      params.push(userId);
      filterSql += ` AND (r.driver_id = $${params.length} OR r.status = 'scheduled')`;
    }

    const ridesRes = await query(
      `SELECT 
        r.ride_id, r.passenger_id, r.driver_id, r.status, r.vehicle_category,
        r.pickup_lat, r.pickup_lng, r.pickup_label,
        r.dropoff_lat, r.dropoff_lng, r.dropoff_label,
        r.distance_km, r.duration_min, r.estimated_fare, r.offered_fare, r.final_fare,
        r.payment_method, r.is_scheduled, r.scheduled_for, r.created_at, r.updated_at,
        u.name as passenger_name, u.phone as passenger_phone,
        d.name as driver_name, d.phone as driver_phone
       FROM rides r
       LEFT JOIN users u ON r.passenger_id = u.id
       LEFT JOIN users d ON r.driver_id = d.id
       ${filterSql}
       ORDER BY r.scheduled_for ASC NULLS LAST, r.created_at DESC`,
      params
    );

    const rideIds = ridesRes.rows.map((r: any) => r.ride_id);
    let stopsMap: Record<string, any[]> = {};

    if (rideIds.length > 0) {
      const stopsRes = await query(
        `SELECT id, ride_id, stop_order, latitude, longitude, label, completed, completed_at
         FROM ride_stops
         WHERE ride_id = ANY($1::text[])
         ORDER BY ride_id, stop_order ASC`,
        [rideIds]
      );
      stopsRes.rows.forEach((s: any) => {
        if (!stopsMap[s.ride_id]) stopsMap[s.ride_id] = [];
        stopsMap[s.ride_id].push({
          id: s.id,
          stopOrder: s.stop_order,
          latitude: s.latitude,
          longitude: s.longitude,
          label: s.label,
          completed: s.completed,
          completedAt: s.completed_at ? parseInt(s.completed_at, 10) : null,
        });
      });
    }

    const rides = ridesRes.rows.map((r: any) => ({
      rideId: r.ride_id,
      passengerId: r.passenger_id,
      passengerName: r.passenger_name || 'Passenger',
      passengerPhone: r.passenger_phone || '',
      driverId: r.driver_id,
      driverName: r.driver_name || null,
      driverPhone: r.driver_phone || null,
      status: r.status,
      vehicleCategory: r.vehicle_category,
      pickup: {
        latitude: r.pickup_lat,
        longitude: r.pickup_lng,
        label: r.pickup_label,
      },
      dropoff: {
        latitude: r.dropoff_lat,
        longitude: r.dropoff_lng,
        label: r.dropoff_label,
      },
      stops: stopsMap[r.ride_id] || [],
      distanceKm: parseFloat(r.distance_km || '0'),
      durationMin: parseInt(r.duration_min || '0', 10),
      estimatedFare: parseFloat(r.estimated_fare || '0'),
      offeredFare: parseFloat(r.offered_fare || '0'),
      finalFare: r.final_fare ? parseFloat(r.final_fare) : null,
      paymentMethod: r.payment_method || 'cash',
      isScheduled: Boolean(r.is_scheduled),
      scheduledFor: r.scheduled_for ? parseInt(r.scheduled_for, 10) : null,
      createdAt: parseInt(r.created_at, 10),
      updatedAt: parseInt(r.updated_at, 10),
    }));

    res.status(200).json({ rides });
  } catch (error: any) {
    console.error('Fetch scheduled rides error:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled rides' });
  }
});

/**
 * PUT /api/v1/rides/:id/stops/:stopId/complete
 * Description: Marks an intermediate waypoint as completed and returns next target.
 */
router.put('/:id/stops/:stopId/complete', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id: rideId, stopId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Verify ride
    const rideRes = await query('SELECT ride_id, passenger_id, driver_id, dropoff_lat, dropoff_lng, dropoff_label FROM rides WHERE ride_id = $1', [rideId]);
    if (rideRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const ride = rideRes.rows[0];
    if (userRole !== 'admin' && userId !== ride.driver_id) {
      return res.status(403).json({ error: 'Only the assigned driver can complete intermediate waypoints' });
    }

    const now = Date.now();
    const updateStopRes = await query(
      `UPDATE ride_stops 
       SET completed = true, completed_at = $1 
       WHERE id = $2 AND ride_id = $3
       RETURNING *`,
      [now, stopId, rideId]
    );

    if (updateStopRes.rows.length === 0) {
      return res.status(404).json({ error: 'Stop not found in this ride' });
    }

    // Fetch remaining incomplete stops
    const remainingRes = await query(
      `SELECT id, stop_order, latitude, longitude, label, completed
       FROM ride_stops
       WHERE ride_id = $1 AND completed = false
       ORDER BY stop_order ASC`,
      [rideId]
    );

    const nextTarget = remainingRes.rows.length > 0 ? {
      isStop: true,
      stopId: remainingRes.rows[0].id,
      stopOrder: remainingRes.rows[0].stop_order,
      latitude: remainingRes.rows[0].latitude,
      longitude: remainingRes.rows[0].longitude,
      label: remainingRes.rows[0].label,
    } : {
      isStop: false,
      stopId: null,
      stopOrder: null,
      latitude: ride.dropoff_lat,
      longitude: ride.dropoff_lng,
      label: ride.dropoff_label,
    };

    res.status(200).json({
      success: true,
      completedStopId: stopId,
      completedAt: now,
      remainingStopsCount: remainingRes.rows.length,
      nextTarget,
    });
  } catch (error: any) {
    console.error('Complete stop error:', error);
    res.status(500).json({ error: 'Failed to complete stop progression' });
  }
});

/**
 * Scheduled Rides Background Auto-Dispatcher
 * Periodically checks for scheduled rides within 20 minutes of departure and transitions them to 'negotiating'.
 */
export async function checkAndDispatchScheduledRides() {
  try {
    const now = Date.now();
    const dispatchWindow = now + (20 * 60 * 1000); // 20 minutes from now

    const dueRidesRes = await query(
      `SELECT ride_id, vehicle_category, pickup_label, offered_fare, estimated_fare, scheduled_for
       FROM rides
       WHERE is_scheduled = true 
         AND status = 'scheduled'
         AND scheduled_for <= $1`,
      [dispatchWindow]
    );

    for (const r of dueRidesRes.rows) {
      await query(
        `UPDATE rides SET status = 'negotiating', scheduled_dispatch_at = $1, updated_at = $1 WHERE ride_id = $2`,
        [now, r.ride_id]
      );

      // Dispatch push broadcast to nearby online verified drivers
      notifyNearbyDrivers(
        r.vehicle_category || 'mini',
        `[Scheduled] ${r.pickup_label || 'Lahore'}`,
        r.offered_fare || r.estimated_fare || 0,
        r.ride_id
      ).catch((err: any) => console.warn('[FCM] Scheduled dispatch error:', err));
    }
  } catch (e: any) {
    console.warn('Scheduled dispatch runner notice:', e?.message);
  }
}

// Run scheduled dispatch checker every 60 seconds
const scheduledDispatchTimer = setInterval(checkAndDispatchScheduledRides, 60000);
if (scheduledDispatchTimer.unref) {
  scheduledDispatchTimer.unref();
}

export default router;

