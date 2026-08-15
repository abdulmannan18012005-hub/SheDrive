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

    const id = `sp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    await query(
      `INSERT INTO saved_places (id, user_id, label, name, latitude, longitude, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, userId, label.trim(), name.trim(), latitude, longitude, now]
    );

    res.status(201).json({
      savedPlace: { id, userId, label, name, latitude, longitude, createdAt: now },
    });
  } catch (error) {
    console.error('Add saved place error:', error);
    res.status(500).json({ error: 'Failed to save location' });
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
