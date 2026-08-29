import { Router, Request, Response } from 'express';
import { query } from '../../config/db';
import { authenticateToken } from '../../middleware/auth';

const router = Router();

/**
 * GET /api/v1/saved-places
 * Headers: Authorization: Bearer <token>
 * Response: 200 OK with list of saved places.
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const result = await query(
      'SELECT id, label, name, latitude, longitude, created_at FROM saved_places WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.status(200).json({ places: result.rows });
  } catch (error) {
    console.error('Fetch saved places error:', error);
    res.status(500).json({ error: 'Failed to fetch saved locations' });
  }
});

/**
 * POST /api/v1/saved-places
 * Headers: Authorization: Bearer <token>
 * Body: { label: string, name: string, latitude: number, longitude: number }
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { label, name, latitude, longitude } = req.body;

    if (!label || !name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Label, location name, latitude, and longitude are required' });
    }

    const lat = typeof latitude === 'number' ? latitude : parseFloat(latitude);
    const lon = typeof longitude === 'number' ? longitude : parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Valid numerical latitude and longitude are required' });
    }

    const id = `sp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    await query(
      `INSERT INTO saved_places (id, user_id, label, name, latitude, longitude, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, userId, label.trim(), name.trim(), lat, lon, now]
    );

    const createdPlace = { id, userId, label: label.trim(), name: name.trim(), latitude: lat, longitude: lon, createdAt: now };
    res.status(201).json({
      success: true,
      savedPlace: createdPlace,
      place: createdPlace,
    });
  } catch (error) {
    console.error('Add saved place error:', error);
    res.status(500).json({ error: 'Failed to save location' });
  }
});

/**
 * PUT /api/v1/saved-places/:id
 * Headers: Authorization: Bearer <token>
 * Body: { label?: string, name?: string, latitude?: number, longitude?: number }
 */
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { label, name, latitude, longitude } = req.body;

    if (label === undefined && name === undefined && latitude === undefined && longitude === undefined) {
      return res.status(400).json({ error: 'At least one field (label, name, latitude, or longitude) is required' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (label !== undefined) { updates.push(`label = $${params.length + 1}`); params.push(label.trim()); }
    if (name !== undefined) { updates.push(`name = $${params.length + 1}`); params.push(name.trim()); }
    if (latitude !== undefined) { updates.push(`latitude = $${params.length + 1}`); params.push(latitude); }
    if (longitude !== undefined) { updates.push(`longitude = $${params.length + 1}`); params.push(longitude); }

    params.push(id);
    params.push(userId);

    await query(
      `UPDATE saved_places SET ${updates.join(', ')} WHERE id = $${params.length - 1} AND user_id = $${params.length}`,
      params
    );

    res.status(200).json({ success: true, message: 'Saved location updated' });
  } catch (error) {
    console.error('Update saved place error:', error);
    res.status(500).json({ error: 'Failed to update saved location' });
  }
});

/**
 * DELETE /api/v1/saved-places/:id
 * Headers: Authorization: Bearer <token>
 */
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    await query('DELETE FROM saved_places WHERE id = $1 AND user_id = $2', [id, userId]);

    res.status(200).json({ success: true, message: 'Saved location removed' });
  } catch (error) {
    console.error('Delete saved place error:', error);
    res.status(500).json({ error: 'Failed to delete saved location' });
  }
});

export default router;
