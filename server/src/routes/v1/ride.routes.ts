import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { query } from '../../config/db';

const router = Router();

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

export default router;
