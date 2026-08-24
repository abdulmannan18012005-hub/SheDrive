import { Router, Request, Response } from 'express';
import { query } from '../../config/db';
import { authenticateToken } from '../../middleware/auth';
import { requireAdmin } from './admin.routes';
import { sendPushNotification } from '../../services/notificationService';

const router = Router();

/**
 * GET /api/v1/admin/compliance/expiries
 * Query: status ('all' | 'expired' | 'expiring_soon'), page, limit
 * Description: Retrieves drivers with document expiries (license, registration, insurance).
 */
router.get('/expiries', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string) || 'all';
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
    const offset = (page - 1) * limit;

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const thresholdFuture = now + thirtyDaysMs;

    // CTE aggregating document expiries from drivers and document_expiry_tracking
    const baseQuery = `
      WITH driver_docs AS (
        SELECT 
          d.driver_id,
          u.name as driver_name,
          u.phone as driver_phone,
          u.city,
          d.vehicle_category,
          d.vehicle_plate,
          'driving_license' as document_type,
          d.license_number as document_number,
          d.license_expiry as expiry_date
        FROM drivers d
        JOIN users u ON d.driver_id = u.id
        WHERE u.verification_status = 'approved' AND d.license_expiry IS NOT NULL
        
        UNION ALL
        
        SELECT 
          d.driver_id,
          u.name as driver_name,
          u.phone as driver_phone,
          u.city,
          d.vehicle_category,
          d.vehicle_plate,
          'vehicle_registration' as document_type,
          d.vehicle_plate as document_number,
          d.registration_expiry as expiry_date
        FROM drivers d
        JOIN users u ON d.driver_id = u.id
        WHERE u.verification_status = 'approved' AND d.registration_expiry IS NOT NULL
        
        UNION ALL
        
        SELECT 
          d.driver_id,
          u.name as driver_name,
          u.phone as driver_phone,
          u.city,
          d.vehicle_category,
          d.vehicle_plate,
          'insurance' as document_type,
          NULL as document_number,
          d.insurance_expiry as expiry_date
        FROM drivers d
        JOIN users u ON d.driver_id = u.id
        WHERE u.verification_status = 'approved' AND d.insurance_expiry IS NOT NULL

        UNION ALL

        SELECT
          t.user_id as driver_id,
          u.name as driver_name,
          u.phone as driver_phone,
          u.city,
          d.vehicle_category,
          d.vehicle_plate,
          t.document_type,
          t.document_number,
          t.expiry_date
        FROM document_expiry_tracking t
        JOIN users u ON t.user_id = u.id
        JOIN drivers d ON t.user_id = d.driver_id
        WHERE u.verification_status = 'approved'
      ),
      classified_docs AS (
        SELECT DISTINCT ON (driver_id, document_type)
          driver_id,
          driver_name,
          driver_phone,
          city,
          vehicle_category,
          vehicle_plate,
          document_type,
          document_number,
          expiry_date,
          CASE 
            WHEN expiry_date < $1 THEN 'expired'
            WHEN expiry_date >= $1 AND expiry_date <= $2 THEN 'expiring_soon'
            ELSE 'valid'
          END as compliance_status,
          ROUND(((expiry_date - $1) / (24 * 60 * 60 * 1000.0))::numeric, 0) as days_remaining
        FROM driver_docs
      )
    `;

    let filterClause = 'WHERE compliance_status IN (\'expired\', \'expiring_soon\')';
    if (status === 'expired') {
      filterClause = 'WHERE compliance_status = \'expired\'';
    } else if (status === 'expiring_soon') {
      filterClause = 'WHERE compliance_status = \'expiring_soon\'';
    } else if (status === 'all') {
      filterClause = 'WHERE 1=1';
    }

    const dataQuery = `
      ${baseQuery}
      SELECT * FROM classified_docs
      ${filterClause}
      ORDER BY expiry_date ASC
      LIMIT $3 OFFSET $4
    `;

    const countQuery = `
      ${baseQuery}
      SELECT COUNT(*) as total FROM classified_docs
      ${filterClause}
    `;

    const [rowsRes, countRes] = await Promise.all([
      query(dataQuery, [now, thresholdFuture, limit, offset]),
      query(countQuery, [now, thresholdFuture]),
    ]);

    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      documents: rowsRes.rows.map((r: any) => ({
        driverId: r.driver_id,
        driverName: r.driver_name,
        driverPhone: r.driver_phone,
        city: r.city,
        vehicleTier: r.vehicle_category,
        vehiclePlate: r.vehicle_plate,
        documentType: r.document_type,
        documentNumber: r.document_number,
        expiryDate: parseInt(r.expiry_date, 10),
        status: r.compliance_status,
        daysRemaining: parseInt(r.days_remaining || '0', 10),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Fetch compliance expiries error:', error);
    res.status(500).json({ error: 'Failed to fetch compliance document expiries' });
  }
});

/**
 * POST /api/v1/admin/compliance/scan
 * Description: Scans driver documents, detects expired/expiring soon, and dispatches automated notices without duplicate spam.
 */
router.post('/scan', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const thresholdFuture = now + thirtyDaysMs;

    // Fetch all drivers with expired or expiring docs
    const scanQuery = `
      WITH driver_docs AS (
        SELECT 
          d.driver_id,
          u.name as driver_name,
          'driving_license' as doc_type,
          d.license_expiry as expiry_date
        FROM drivers d
        JOIN users u ON d.driver_id = u.id
        WHERE u.verification_status = 'approved' AND d.license_expiry IS NOT NULL
        
        UNION ALL
        
        SELECT 
          d.driver_id,
          u.name as driver_name,
          'vehicle_registration' as doc_type,
          d.registration_expiry as expiry_date
        FROM drivers d
        JOIN users u ON d.driver_id = u.id
        WHERE u.verification_status = 'approved' AND d.registration_expiry IS NOT NULL
        
        UNION ALL
        
        SELECT 
          d.driver_id,
          u.name as driver_name,
          'insurance' as doc_type,
          d.insurance_expiry as expiry_date
        FROM drivers d
        JOIN users u ON d.driver_id = u.id
        WHERE u.verification_status = 'approved' AND d.insurance_expiry IS NOT NULL
      )
      SELECT DISTINCT ON (driver_id, doc_type)
        driver_id,
        driver_name,
        doc_type,
        expiry_date,
        CASE 
          WHEN expiry_date < $1 THEN 'expired'
          ELSE 'expiring_soon'
        END as status
      FROM driver_docs
      WHERE expiry_date <= $2
    `;

    const scanRes = await query(scanQuery, [now, thresholdFuture]);
    const items = scanRes.rows;

    let expiredCount = 0;
    let expiringSoonCount = 0;
    let noticesDispatchedCount = 0;

    for (const item of items) {
      if (item.status === 'expired') expiredCount++;
      else expiringSoonCount++;

      // Check if notice was already dispatched within the last 7 days to avoid duplicate spam
      const recentNoticeRes = await query(
        `SELECT id FROM user_notifications 
         WHERE user_id = $1 AND category = 'document_expiry' AND created_at >= $2
         LIMIT 1`,
        [item.driver_id, now - sevenDaysMs]
      );

      if (recentNoticeRes.rows.length === 0) {
        const notifId = `notif_exp_${now}_${Math.random().toString(36).substring(2, 6)}`;
        const docName = item.doc_type.replace(/_/g, ' ');
        const isExpired = item.status === 'expired';
        const title = isExpired ? `⚠️ ${docName.toUpperCase()} Expired` : `📋 ${docName.toUpperCase()} Expiring Soon`;
        const message = isExpired
          ? `Your ${docName} has expired. Please update your document details in the SheDrive Driver app to maintain active partner status.`
          : `Your ${docName} is set to expire within 30 days. Please renew and upload your updated document to avoid dispatch suspension.`;

        // 1. In-app notification write
        await query(
          `INSERT INTO user_notifications (id, user_id, title, message, category, is_read, created_at)
           VALUES ($1, $2, $3, $4, 'document_expiry', false, $5)`,
          [notifId, item.driver_id, title, message, now]
        ).catch((e: any) => console.warn('Compliance in-app notification error:', e?.message));

        // 2. FCM Push alert
        sendPushNotification({
          userId: item.driver_id,
          title,
          body: message,
          data: { type: 'DOCUMENT_EXPIRY', docType: item.doc_type, status: item.status },
        }).catch(err => console.warn('[FCM] Compliance push error:', err?.message));

        noticesDispatchedCount++;
      }
    }

    // Audit log entry
    const auditId = `log_${now}_${Math.random().toString(36).substring(2, 7)}`;
    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [
        auditId,
        (req as any).user?.id || 'admin',
        'SCAN_COMPLIANCE',
        `Automated compliance scan completed. Flagged ${items.length} documents (${expiredCount} expired, ${expiringSoonCount} expiring soon). Dispatched ${noticesDispatchedCount} automated notifications.`,
        now,
      ]
    ).catch((e: any) => console.warn('Compliance audit log write failed:', e?.message));

    res.status(200).json({
      success: true,
      scannedDocumentsCount: items.length,
      expiredCount,
      expiringSoonCount,
      noticesDispatchedCount,
      timestamp: now,
    });
  } catch (error: any) {
    console.error('Compliance scan error:', error);
    res.status(500).json({ error: 'Failed to execute compliance scan' });
  }
});

export default router;
