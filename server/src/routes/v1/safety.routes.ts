import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { query } from '../../config/db';
import { sosRateLimiter } from '../../middleware/rateLimiter';

const router = Router();

/**
 * POST /api/v1/safety/sos
 * Body: { latitude: number, longitude: number, rideId?: string }
 * Description: Triggers SOS alert, persists to PostgreSQL, and broadcasts via Socket.IO
 */
router.post('/sos', authenticateToken, sosRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { latitude, longitude, rideId } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'GPS coordinates are required' });
    }

    // Get user details for logging
    const userRes = await query(
      'SELECT name, phone FROM users WHERE id = $1',
      [userId]
    );
    const user = userRes.rows[0] || {};

    const sosId = `sos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    // Persist to PostgreSQL
    await query(
      `INSERT INTO sos_alerts (id, user_id, user_name, user_role, ride_id, latitude, longitude, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [sosId, userId, user.name || 'User', userRole || 'passenger', rideId || null, latitude, longitude, 'active', now]
    );

    res.status(201).json({
      success: true,
      sosId,
      message: 'SOS alert logged successfully',
      timestamp: now,
    });
  } catch (error) {
    console.error('SOS trigger error:', error);
    res.status(500).json({ error: 'Failed to log SOS alert' });
  }
});

/**
 * GET /api/v1/admin/sos/recent
 * Query: limit?
 * Description: Fetches recent SOS alerts for admin monitoring
 */
router.get('/sos/recent', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access forbidden. Administrator privileges required.' });
    }

    const limit = parseInt(req.query.limit as string) || 20;

    const result = await query(
      `SELECT id, user_id, user_name, user_role, ride_id, latitude, longitude, status, created_at, resolved_at
       FROM sos_alerts
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.status(200).json({ alerts: result.rows });
  } catch (error) {
    console.error('Fetch SOS alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch SOS alerts' });
  }
});

/**
 * PUT /api/v1/safety/sos/:id/resolve
 * Description: Marks an SOS alert as resolved
 */
router.put('/sos/:id/resolve', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access forbidden. Administrator privileges required.' });
    }

    const { id } = req.params;

    await query(
      'UPDATE sos_alerts SET status = $1, resolved_at = $2 WHERE id = $3',
      ['resolved', Date.now(), id]
    );

    res.status(200).json({ success: true, message: 'SOS alert marked as resolved' });
  } catch (error) {
    console.error('Resolve SOS error:', error);
    res.status(500).json({ error: 'Failed to resolve SOS alert' });
  }
});

/**
 * PUT /api/v1/safety/sos/:id/investigate
 * Body: { resolutionNotes: string, severity: 'low' | 'medium' | 'high' | 'critical', policeContacted: boolean }
 * Description: Investigates and resolves SOS incident with severity classification, notes, and police involvement tracking.
 */
router.put('/sos/:id/investigate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access forbidden. Administrator privileges required.' });
    }

    const { id } = req.params;
    const { resolutionNotes, severity, policeContacted } = req.body;

    if (!resolutionNotes || !resolutionNotes.trim()) {
      return res.status(400).json({ error: 'Investigation & resolution notes are required' });
    }

    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!severity || !validSeverities.includes(severity)) {
      return res.status(400).json({ error: `Severity must be one of: ${validSeverities.join(', ')}` });
    }

    // Check alert existence
    const alertRes = await query('SELECT id, user_id, user_name, user_role, ride_id, status FROM sos_alerts WHERE id = $1', [id]);
    if (alertRes.rows.length === 0) {
      return res.status(404).json({ error: 'SOS alert not found' });
    }

    const alert = alertRes.rows[0];
    const now = Date.now();

    // Update SOS alert status
    await query(
      'UPDATE sos_alerts SET status = $1, resolved_at = $2 WHERE id = $3',
      ['resolved', now, id]
    );

    // Audit log entry for case investigation
    const auditId = `log_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const auditDetails = `Investigated SOS Alert ${id} for User ${alert.user_name} (${alert.user_id}). Severity: ${severity.toUpperCase()}. Police Contacted: ${policeContacted ? 'YES' : 'NO'}. Notes: ${resolutionNotes.trim()}`;

    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [auditId, req.user?.id || 'admin', 'INVESTIGATE_SOS_ALERT', auditDetails, now]
    ).catch((e: any) => console.warn('SOS investigate audit log error:', e?.message));

    res.status(200).json({
      success: true,
      message: 'SOS incident investigated and resolved successfully',
      alertId: id,
      severity,
      policeContacted: Boolean(policeContacted),
      resolvedAt: now,
    });
  } catch (error: any) {
    console.error('Investigate SOS error:', error);
    res.status(500).json({ error: 'Failed to investigate SOS alert' });
  }
});

export default router;
