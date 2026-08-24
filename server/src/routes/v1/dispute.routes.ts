import { Router, Request, Response } from 'express';
import { query } from '../../config/db';
import { authenticateToken } from '../../middleware/auth';
import { requireAdmin } from './admin.routes';
import { sendPushNotification } from '../../services/notificationService';

const router = Router();

/**
 * GET /api/v1/admin/disputes
 * Query: status ('all' | 'pending' | 'resolved' | 'rejected'), page, limit
 * Description: Retrieves paginated ride disputes/complaints submitted by passengers or drivers.
 */
router.get('/', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string) || 'all';
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
    const offset = (page - 1) * limit;

    let filterSql = 'WHERE 1=1';
    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(status);
      filterSql += ` AND c.status = $${params.length}`;
    }

    const dataParams = [...params, limit, offset];
    const dataQuery = `
      SELECT 
        c.id as dispute_id,
        c.ride_id,
        c.user_id,
        u.name as user_name,
        u.phone as user_phone,
        u.role as user_role,
        c.subject,
        c.message,
        c.status,
        c.created_at,
        r.vehicle_category,
        r.pickup_label,
        r.dropoff_label,
        COALESCE(r.final_fare, r.offered_fare, 0) as ride_fare,
        r.status as ride_status
      FROM complaints c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN rides r ON c.ride_id = r.ride_id
      ${filterSql}
      ORDER BY c.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM complaints c
      ${filterSql}
    `;

    const [disputesRes, countRes] = await Promise.all([
      query(dataQuery, dataParams),
      query(countQuery, params),
    ]);

    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      disputes: disputesRes.rows.map((r: any) => ({
        id: r.dispute_id,
        rideId: r.ride_id,
        userId: r.user_id,
        userName: r.user_name || 'Community Member',
        userPhone: r.user_phone || 'N/A',
        userRole: r.user_role || 'passenger',
        subject: r.subject,
        message: r.message,
        status: r.status,
        createdAt: parseInt(r.created_at, 10),
        vehicleTier: r.vehicle_category || 'standard',
        pickup: r.pickup_label || 'N/A',
        dropoff: r.dropoff_label || 'N/A',
        rideFare: parseFloat(r.ride_fare || '0'),
        rideStatus: r.ride_status || 'N/A',
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Fetch disputes error:', error);
    res.status(500).json({ error: 'Failed to fetch ride disputes' });
  }
});

/**
 * PUT /api/v1/admin/disputes/:id/resolve
 * Body: { resolutionNotes: string, actionTaken: "warning_issued" | "fare_adjusted" | "dismissed", adjustmentAmount?: number }
 * Description: Atomically resolves or rejects a dispute, issues notification, and records audit trail.
 */
router.put('/:id/resolve', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolutionNotes, actionTaken, adjustmentAmount } = req.body;

    if (!resolutionNotes || !resolutionNotes.trim()) {
      return res.status(400).json({ error: 'Resolution notes are required' });
    }

    const validActions = ['warning_issued', 'fare_adjusted', 'dismissed'];
    if (!actionTaken || !validActions.includes(actionTaken)) {
      return res.status(400).json({ error: `Action taken must be one of: ${validActions.join(', ')}` });
    }

    if (adjustmentAmount !== undefined && (isNaN(Number(adjustmentAmount)) || Number(adjustmentAmount) < 0)) {
      return res.status(400).json({ error: 'Adjustment amount must be a positive number' });
    }

    // Check dispute existence
    const disputeRes = await query(
      'SELECT id, user_id, ride_id, subject, status FROM complaints WHERE id = $1',
      [id]
    );

    if (disputeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const dispute = disputeRes.rows[0];

    // Atomic status transition - ensure dispute is pending
    const newStatus = actionTaken === 'dismissed' ? 'rejected' : 'resolved';
    const updateRes = await query(
      `UPDATE complaints 
       SET status = $1 
       WHERE id = $2 AND status = 'pending'`,
      [newStatus, id]
    );

    if ((updateRes as any).rowCount === 0) {
      return res.status(409).json({ error: 'Dispute has already been resolved or rejected' });
    }

    const now = Date.now();
    const adminUser = (req as any).user;

    // 1. In-app notification to the complainant
    const notifId = `notif_disp_${now}_${Math.random().toString(36).substring(2, 6)}`;
    const notifTitle = actionTaken === 'dismissed'
      ? 'Dispute Reviewed & Closed'
      : (actionTaken === 'fare_adjusted' ? 'Fare Adjustment Approved' : 'Dispute Resolved');
    
    let notifBody = `Your dispute regarding "${dispute.subject}" has been reviewed by SheDrive Admin. ${resolutionNotes.trim()}`;
    if (actionTaken === 'fare_adjusted' && adjustmentAmount) {
      notifBody += ` A fare adjustment of Rs. ${adjustmentAmount} has been approved.`;
    }

    await query(
      `INSERT INTO user_notifications (id, user_id, title, message, category, is_read, created_at)
       VALUES ($1, $2, $3, $4, 'ride', false, $5)`,
      [notifId, dispute.user_id, notifTitle, notifBody, now]
    ).catch((e: any) => console.warn('Dispute notification write failed:', e?.message));

    // 2. Push notification
    sendPushNotification({
      userId: dispute.user_id,
      title: notifTitle,
      body: notifBody,
      data: { type: 'DISPUTE_RESOLVED', disputeId: id, actionTaken },
    }).catch(err => console.warn('[FCM] Dispute push error:', err?.message));

    // 3. Audit log write
    const auditId = `log_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const auditDetails = `Resolved dispute ${id} (Subject: "${dispute.subject}") for User ${dispute.user_id}. Action: ${actionTaken}. Notes: ${resolutionNotes.trim()}${adjustmentAmount ? `. Adjustment: Rs. ${adjustmentAmount}` : ''}`;
    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [auditId, adminUser?.id || 'admin', 'RESOLVE_DISPUTE', auditDetails, now]
    ).catch((e: any) => console.warn('Dispute audit log error:', e?.message));

    res.status(200).json({
      success: true,
      message: `Dispute successfully marked as ${newStatus}`,
      disputeId: id,
      status: newStatus,
      actionTaken,
    });
  } catch (error: any) {
    console.error('Resolve dispute error:', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

export default router;
