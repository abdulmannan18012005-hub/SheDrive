import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { query } from '../../config/db';

const router = Router();

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

// Create new ride request
router.post('/request', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const {
      vehicleCategory,
      pickup,
      destination,
      distanceKm,
      durationMin,
      estimatedFare,
      offeredFare,
      polyline,
    } = req.body;

    const passengerId = req.user?.id;
    if (!passengerId || !pickup || !destination) {
      return res.status(400).json({ error: 'Missing ride parameters' });
    }

    const rideId = `ride_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    await query(
      `INSERT INTO rides (
        ride_id, passenger_id, status, vehicle_category,
        pickup_lat, pickup_lng, pickup_label,
        dropoff_lat, dropoff_lng, dropoff_label,
        distance_km, duration_min, estimated_fare, offered_fare, polyline,
        created_at, updated_at
      ) VALUES ($1, $2, 'requested', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        rideId,
        passengerId,
        vehicleCategory || 'mini',
        pickup.latitude,
        pickup.longitude,
        pickup.label || '',
        destination.latitude,
        destination.longitude,
        destination.label || '',
        distanceKm || 0,
        durationMin || 0,
        estimatedFare || 0,
        offeredFare || estimatedFare || 0,
        polyline || '',
        now,
        now,
      ]
    );

    res.status(201).json({
      rideId,
      passengerId,
      status: 'requested',
      vehicleCategory,
      pickup,
      destination,
      estimatedFare,
      offeredFare,
    });
  } catch (error) {
    console.error('Create ride error:', error);
    res.status(500).json({ error: 'Failed to submit ride request' });
  }
});

// Fetch active ride for passenger or driver
router.get('/active', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    const column = role === 'driver' ? 'driver_id' : 'passenger_id';
    const result = await query(
      `SELECT * FROM rides WHERE ${column} = $1 AND status IN ('requested', 'negotiating', 'accepted', 'arrived', 'in_progress') ORDER BY created_at DESC LIMIT 1`,
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
router.get('/track/:shareToken', async (req: any, res: Response) => {
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

export default router;
