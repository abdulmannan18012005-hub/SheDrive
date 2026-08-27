import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';
import { generateToken, comparePassword, hashPassword, authenticateToken } from '../../middleware/auth';
import { sendPushNotification } from '../../services/notificationService';

const router = Router();

// Middleware to enforce role === 'admin'
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Access forbidden. Administrator privileges required.' });
  }
  next();
};

/**
 * POST /api/v1/admin/login
 * Body: { email, password }
 * Description: Authenticates Super Admin and returns JWT token.
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Query database for existing admin accounts first
    let dbAdminExists = false;
    try {
      const result = await query("SELECT * FROM users WHERE email = $1 AND role = 'admin'", [cleanEmail]);
      if (result.rows.length > 0) {
        dbAdminExists = true;
        const adminUser = result.rows[0];
        let isMatch = await comparePassword(password, adminUser.password_hash);
        
        // Fallback for default super admin ONLY if DB hash is the initial un-updated placeholder
        const isDefaultPlaceholder = adminUser.password_hash === '$2b$10$wT2H3M7P5h9Z8G1X1K3O2e.Y8rZ5m1V2b3c4d5e6f7g8h9i0j1k2l';
        if (!isMatch && isDefaultPlaceholder && cleanEmail === 'admin@shedrive.com' && password === 'Admin#2026!') {
          isMatch = true;
        }

        if (isMatch) {
          const token = generateToken({ id: adminUser.id, email: adminUser.email, role: 'admin' });
          return res.status(200).json({
            user: { id: adminUser.id, email: adminUser.email, name: adminUser.name, role: 'admin' },
            token,
          });
        }
        return res.status(401).json({ error: 'Invalid administrator credentials' });
      }
    } catch (e) {
      console.warn('DB Query notice during admin login check');
    }

    // 2. Direct check for initial default Super Admin credentials if not yet in DB
    if (!dbAdminExists && cleanEmail === 'admin@shedrive.com' && password === 'Admin#2026!') {
      const adminId = 'admin_super_01';
      const token = generateToken({ id: adminId, email: 'admin@shedrive.com', role: 'admin' });

      // Try inserting default record into DB asynchronously
      try {
        const passHash = await hashPassword('Admin#2026!');
        await query(
          `INSERT INTO users (id, email, password_hash, name, phone, role, is_verified, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (email) DO NOTHING`,
          [adminId, 'admin@shedrive.com', passHash, 'Super Admin', '+92 42 111 743 374', 'admin', true, Date.now(), Date.now()]
        );
      } catch (dbErr) {
        // Ignored
      }

      return res.status(200).json({
        user: { id: adminId, email: 'admin@shedrive.com', name: 'Super Admin', role: 'admin' },
        token,
      });
    }

    return res.status(401).json({ error: 'Invalid administrator credentials' });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Admin authentication failed' });
  }
});

/**
 * GET /api/v1/admin/stats
 * Headers: Authorization: Bearer <admin_token>
 * Description: Calculates real-time database dashboard analytics.
 */
router.get('/stats', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [
      onlineDriversRes,
      completedTodayRes,
      pendingDriversRes,
      totalPassengersRes,
      activeRidesRes,
    ] = await Promise.all([
      query('SELECT COUNT(*) FROM drivers WHERE is_online = true'),
      query("SELECT COUNT(*), COALESCE(SUM(final_fare), 0) as revenue FROM rides WHERE status = 'completed'"),
      query("SELECT COUNT(*) FROM users u JOIN drivers d ON u.id = d.driver_id WHERE u.verification_status = 'pending'"),
      query("SELECT COUNT(*) FROM users WHERE role = 'passenger'"),
      query("SELECT COUNT(*) FROM rides WHERE status IN ('requested', 'negotiating', 'accepted', 'arrived', 'in_progress')"),
    ]);

    res.status(200).json({
      onlineDrivers: parseInt(onlineDriversRes.rows[0]?.count || '0', 10),
      completedRidesToday: parseInt(completedTodayRes.rows[0]?.count || '0', 10),
      platformGrossRevenue: parseInt(completedTodayRes.rows[0]?.revenue || '0', 10),
      pendingVerifications: parseInt(pendingDriversRes.rows[0]?.count || '0', 10),
      totalPassengers: parseInt(totalPassengersRes.rows[0]?.count || '0', 10),
      activeRides: parseInt(activeRidesRes.rows[0]?.count || '0', 10),
    });
  } catch (error) {
    console.error('Fetch admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

/**
 * GET /api/v1/admin/drivers/pending
 * Description: Returns list of unverified drivers with complete document URLs.
 * Only shows drivers with verification_status = 'pending'
 */
router.get('/drivers/pending', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.phone, u.email, u.cnic, u.cnic_front_url, u.cnic_back_url, u.date_of_birth, u.verification_status,
              d.vehicle_category, d.vehicle_make, d.vehicle_model, d.vehicle_plate, d.vehicle_color, d.vehicle_year,
              d.license_front_url, d.license_back_url, d.selfie_url, d.vehicle_photo_url, u.is_verified, d.is_active
       FROM users u
       JOIN drivers d ON u.id = d.driver_id
       WHERE u.verification_status = 'pending'
       ORDER BY u.created_at DESC`
    );

    res.status(200).json({ pendingDrivers: result.rows });
  } catch (error) {
    console.error('Fetch pending drivers error:', error);
    res.status(500).json({ error: 'Failed to fetch pending driver queue' });
  }
});

/**
 * PUT /api/v1/admin/drivers/:id/verify
 * Body: { approve: boolean, reason?: string }
 * Description: Approves or rejects driver document verification application.
 * Updates verification_status to 'approved' or 'rejected' accordingly.
 * When rejecting, stores rejection reason and timestamp for 24-hour cooldown.
 */
router.put('/drivers/:id/verify', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approve, reason } = req.body;

    if (approve) {
      await query(
        'UPDATE users SET is_verified = true, is_blocked = false, verification_status = $1, updated_at = $2, rejection_timestamp = NULL, rejection_reason = NULL WHERE id = $3',
        ['approved', Date.now(), id]
      );
      await query('UPDATE drivers SET is_active = true, is_available = true WHERE driver_id = $1', [id]);

      // Push notification to driver (non-blocking)
      sendPushNotification({
        userId: id,
        title: '🛡️ Account Verified & Approved!',
        body: 'Congratulations! Your SheDrive partner profile is approved. You can now go online.',
        data: { type: 'driver_verified', driverId: id },
      }).catch(err => console.warn('[FCM] Driver approval push notification error:', err));

      // Audit log entry (non-blocking)
      query(
        'INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
        [`log_${Date.now()}`, (req as any).user.id, 'APPROVE_DRIVER', `Approved driver verification ID ${id}`, Date.now()]
      ).catch((e: any) => console.warn('Audit log write failed (non-critical):', e?.message));

      return res.status(200).json({ success: true, message: 'Driver verified and approved successfully' });
    } else {
      await query(
        'UPDATE users SET is_verified = false, verification_status = $1, updated_at = $2, rejection_timestamp = $3, rejection_reason = $4 WHERE id = $5',
        ['rejected', Date.now(), Date.now(), reason || 'Documents did not meet verification standards', id]
      );
      await query('UPDATE drivers SET is_active = false, is_available = false WHERE driver_id = $1', [id]);

      // Push notification to driver (non-blocking)
      sendPushNotification({
        userId: id,
        title: '⚠️ Verification Action Required',
        body: `Your application status: ${reason || 'Documents did not meet verification standards. Please resubmit.'}`,
        data: { type: 'driver_rejected', driverId: id, reason: reason || '' },
      }).catch(err => console.warn('[FCM] Driver rejection push notification error:', err));

      query(
        'INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
        [`log_${Date.now()}`, (req as any).user.id, 'REJECT_DRIVER', `Rejected driver verification ID ${id}. Reason: ${reason || 'Not specified'}`, Date.now()]
      ).catch((e: any) => console.warn('Audit log write failed (non-critical):', e?.message));

      return res.status(200).json({ success: true, message: 'Driver application rejected' });
    }
  } catch (error) {
    console.error('Verify driver error:', error);
    res.status(500).json({ error: 'Failed to update driver verification status' });
  }
});

/**
 * PUT /api/v1/admin/drivers/:id/block
 * Body: { block: boolean }
 * Description: Blocks or unblocks driver account.
 */
router.put('/drivers/:id/block', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { block } = req.body;

    const userCheck = await query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    await query('UPDATE users SET is_blocked = $1, updated_at = $2 WHERE id = $3', [
      Boolean(block),
      Date.now(),
      id,
    ]);

    if (block) {
      await query('UPDATE drivers SET is_online = false, is_available = false WHERE driver_id = $1', [id]).catch(() => {});
    }

    query(
      'INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [
        `log_${Date.now()}`,
        (req as any).user.id,
        block ? 'BLOCK_DRIVER' : 'UNBLOCK_DRIVER',
        `${block ? 'Blocked' : 'Unblocked'} driver ID ${id}`,
        Date.now(),
      ]
    ).catch((e: any) => console.warn('Audit log write failed (non-critical):', e?.message));

    return res.status(200).json({
      success: true,
      message: block ? 'Driver account has been temporarily blocked' : 'Driver account unblocked successfully',
    });
  } catch (error) {
    console.error('Block driver error:', error);
    res.status(500).json({ error: 'Failed to update driver block status' });
  }
});

/**
 * GET /api/v1/admin/passengers
 * Query: page?, limit?, search?
 * Description: Returns paginated list of passengers with search support.
 */
router.get('/passengers', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = (req.query.search as string || '').trim();

    const offset = (page - 1) * limit;

    let queryStr = `
      SELECT u.id, u.name, u.phone, u.email, u.cnic, u.is_verified, u.is_blocked, u.created_at,
              COUNT(r.ride_id) as total_rides
       FROM users u
       LEFT JOIN rides r ON u.id = r.passenger_id
       WHERE u.role = 'passenger'`;

    const params: any[] = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      queryStr += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(u.phone) LIKE $${params.length})`;
    }

    queryStr += ` GROUP BY u.id`;

    // Get total count for pagination
    let countQueryStr = `SELECT COUNT(DISTINCT u.id) as total FROM users u WHERE u.role = 'passenger'`;
    const countParams: any[] = [];
    if (search) {
      countParams.push(`%${search.toLowerCase()}%`);
      countQueryStr += ` AND (LOWER(u.name) LIKE $${countParams.length} OR LOWER(u.email) LIKE $${countParams.length} OR LOWER(u.phone) LIKE $${countParams.length})`;
    }
    const countResult = await query(countQueryStr, countParams);
    const total = countResult.rows && countResult.rows.length > 0 ? parseInt(countResult.rows[0].total || '0', 10) : 0;

    // Get paginated data
    queryStr += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);

    res.status(200).json({
      passengers: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Fetch passengers error:', error);
    res.status(500).json({ error: 'Failed to fetch passengers' });
  }
});

/**
 * PUT /api/v1/admin/passengers/:id/block
 */
router.put('/passengers/:id/block', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { block } = req.body;

    await query('UPDATE users SET is_blocked = $1, updated_at = $2 WHERE id = $3 AND role = \'passenger\'', [Boolean(block), Date.now(), id]);

    query(
      'INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [
        `log_${Date.now()}`,
        (req as any).user.id,
        block ? 'BLOCK_PASSENGER' : 'UNBLOCK_PASSENGER',
        `${block ? 'Blocked' : 'Unblocked'} passenger ID ${id}`,
        Date.now(),
      ]
    ).catch((e: any) => console.warn('Audit log write failed (non-critical):', e?.message));

    return res.status(200).json({
      success: true,
      message: block ? 'Passenger account has been temporarily blocked' : 'Passenger account unblocked successfully',
    });
  } catch (error) {
    console.error('Block passenger error:', error);
    res.status(500).json({ error: 'Failed to update passenger block status' });
  }
});

/**
 * GET /api/v1/admin/drivers
 * Query: page?, limit?, search?, status?
 * Description: Returns paginated list of drivers with search and filter support.
 */
router.get('/drivers', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = (req.query.search as string || '').trim();
    const status = req.query.status as string;

    const offset = (page - 1) * limit;

    let queryStr = `
      SELECT u.id, u.name, u.phone, u.email, u.cnic, u.cnic_front_url, u.cnic_back_url, u.is_verified, u.is_blocked, u.date_of_birth, u.verification_status,
              d.vehicle_category, d.vehicle_make, d.vehicle_model, d.vehicle_plate, d.vehicle_color, d.vehicle_year,
              d.license_front_url, d.license_back_url, d.selfie_url, d.vehicle_photo_url, d.rating, d.total_rides, d.is_online, d.is_active
       FROM users u
       JOIN drivers d ON u.id = d.driver_id
       WHERE 1=1`;

    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(status);
      queryStr += ` AND u.verification_status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      queryStr += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(u.phone) LIKE $${params.length} OR LOWER(d.vehicle_plate) LIKE $${params.length} OR LOWER(d.vehicle_make) LIKE $${params.length} OR LOWER(d.vehicle_model) LIKE $${params.length})`;
    }

    // Get total count for pagination
    let countQueryStr = `SELECT COUNT(*) as total FROM users u JOIN drivers d ON u.id = d.driver_id WHERE 1=1`;
    const countParams: any[] = [];
    if (status && status !== 'all') {
      countParams.push(status);
      countQueryStr += ` AND u.verification_status = $${countParams.length}`;
    }
    if (search) {
      countParams.push(`%${search.toLowerCase()}%`);
      countQueryStr += ` AND (LOWER(u.name) LIKE $${countParams.length} OR LOWER(u.email) LIKE $${countParams.length} OR LOWER(u.phone) LIKE $${countParams.length} OR LOWER(d.vehicle_plate) LIKE $${countParams.length} OR LOWER(d.vehicle_make) LIKE $${countParams.length} OR LOWER(d.vehicle_model) LIKE $${countParams.length})`;
    }
    const countResult = await query(countQueryStr, countParams);
    const total = countResult.rows && countResult.rows.length > 0 ? parseInt(countResult.rows[0].total || '0', 10) : 0;

    // Get paginated data
    queryStr += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);

    res.status(200).json({
      drivers: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Fetch drivers roster error:', error);
    res.status(500).json({ error: 'Failed to fetch driver roster' });
  }
});

/**
 * GET /api/v1/admin/rides/live
 */
router.get('/rides/live', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT r.*, pu.name as passenger_name, du.name as driver_name
       FROM rides r
       JOIN users pu ON r.passenger_id = pu.id
       LEFT JOIN users du ON r.driver_id = du.id
       WHERE r.status IN ('requested', 'negotiating', 'accepted', 'arrived', 'in_progress', 'enroute')
       ORDER BY r.created_at DESC`
    );
    res.status(200).json({ liveRides: result.rows });
  } catch (error) {
    console.error('Fetch live rides error:', error);
    res.status(500).json({ error: 'Failed to fetch live rides' });
  }
});

/**
 * GET /api/v1/admin/settings & POST /api/v1/admin/settings
 */
router.get('/settings', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM admin_settings WHERE id = 1');
    const defaultCategoryFares = [
      { id: 'bike', name: 'Bike / Scooty', baseFare: 60, perKmRate: 25, perMinuteRate: 2, minimumFare: 50 },
      { id: 'mini', name: 'SheDrive Mini', baseFare: 100, perKmRate: 40, perMinuteRate: 3, minimumFare: 80 },
      { id: 'sedan', name: 'SheDrive Sedan AC', baseFare: 150, perKmRate: 50, perMinuteRate: 4, minimumFare: 120 },
      { id: 'comfort', name: 'SheDrive Comfort AC', baseFare: 180, perKmRate: 60, perMinuteRate: 5, minimumFare: 150 },
      { id: 'premium', name: 'SheDrive Premium', baseFare: 250, perKmRate: 80, perMinuteRate: 6, minimumFare: 200 },
      { id: 'family', name: 'SheDrive Family XL', baseFare: 300, perKmRate: 90, perMinuteRate: 7, minimumFare: 250 },
    ];

    let settings = {
      commission_pct: 5.0,
      sos_hotline: '+92 42 111 743 374',
      category_fares: defaultCategoryFares,
      raast_id: '03001234567',
      raast_qr_url: '',
      bank_account_number: 'PK92MEZN0009988776655',
      iban: 'PK92MEZN000998877665544332211',
    };

    if (result.rows.length > 0) {
      const row = result.rows[0];
      settings.commission_pct = parseFloat(row.commission_pct) || 5.0;
      settings.sos_hotline = row.sos_hotline || '+92 42 111 743 374';
      settings.raast_id = row.raast_id || '03001234567';
      settings.raast_qr_url = row.raast_qr_url || '';
      settings.bank_account_number = row.bank_account_number || 'PK92MEZN0009988776655';
      settings.iban = row.iban || 'PK92MEZN000998877665544332211';
      if (row.category_fares) {
        try {
          settings.category_fares = typeof row.category_fares === 'string' ? JSON.parse(row.category_fares) : row.category_fares;
        } catch (e) {
          settings.category_fares = defaultCategoryFares;
        }
      }
    }

    res.status(200).json({ settings });
  } catch (error) {
    console.error('Fetch settings error:', error);
    res.status(500).json({ error: 'Failed to fetch platform settings' });
  }
});

router.post('/settings', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { commissionPct, sosHotline, categoryFares, raastId, raastQrUrl, bankAccountNumber, iban } = req.body;
    const categoryFaresJson = typeof categoryFares === 'string' ? categoryFares : JSON.stringify(categoryFares || []);

    const now = Date.now();
    const finalCommissionPct = commissionPct !== undefined ? Math.max(0, Math.min(100, parseFloat(commissionPct) || 5.0)) : 5.0;
    const finalSosHotline = sosHotline || '+92 42 111 743 374';
    const finalRaastId = raastId !== undefined ? String(raastId).trim() : '03001234567';
    const finalRaastQrUrl = raastQrUrl !== undefined ? String(raastQrUrl).trim() : '';
    const finalBankAccountNumber = bankAccountNumber !== undefined ? String(bankAccountNumber).trim() : 'PK92MEZN0009988776655';
    const finalIban = iban !== undefined ? String(iban).trim() : 'PK92MEZN000998877665544332211';

    await query(
      `INSERT INTO admin_settings (id, commission_pct, sos_hotline, category_fares, raast_id, raast_qr_url, bank_account_number, iban, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         commission_pct = EXCLUDED.commission_pct,
         sos_hotline = EXCLUDED.sos_hotline,
         category_fares = EXCLUDED.category_fares,
         raast_id = EXCLUDED.raast_id,
         raast_qr_url = EXCLUDED.raast_qr_url,
         bank_account_number = EXCLUDED.bank_account_number,
         iban = EXCLUDED.iban,
         updated_at = EXCLUDED.updated_at`,
      [
        1,
        finalCommissionPct,
        finalSosHotline,
        categoryFaresJson,
        finalRaastId,
        finalRaastQrUrl,
        finalBankAccountNumber,
        finalIban,
        now,
      ]
    );
    res.status(200).json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Save settings error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

/**
 * PUT /api/v1/admin/credentials
 * Body: { currentPassword, newEmail?, newPassword? }
 * Description: Updates Admin Portal email/username and password after current password verification.
 */
router.put('/credentials', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).user;
    const { currentPassword, newEmail, newPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to update credentials' });
    }

    if (!newEmail && !newPassword) {
      return res.status(400).json({ error: 'Please provide a new email or new password to update' });
    }

    const adminId = adminUser.id || 'admin_super_01';
    const currentEmail = (adminUser.email || 'admin@shedrive.com').toLowerCase();

    // 1. Fetch current admin record from database or check fallback
    let dbAdmin: any = null;
    try {
      const adminRes = await query("SELECT * FROM users WHERE role = 'admin' AND (id = $1 OR email = $2)", [adminId, currentEmail]);
      if (adminRes.rows.length > 0) {
        dbAdmin = adminRes.rows[0];
      }
    } catch (e) {
      // Proceed to fallback check
    }

    // 2. Verify Current Password
    let isCurrentValid = false;
    if (dbAdmin && dbAdmin.password_hash) {
      isCurrentValid = await comparePassword(currentPassword, dbAdmin.password_hash);
    }

    if (!isCurrentValid) {
      return res.status(400).json({ error: 'Current password Verification Failed. Please enter your correct current password.' });
    }

    // 3. Prepare Updates
    let updatedEmail = dbAdmin?.email || currentEmail;
    let updatedHash = dbAdmin?.password_hash;

    if (newEmail && newEmail.trim()) {
      const cleanNewEmail = newEmail.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanNewEmail)) {
        return res.status(400).json({ error: 'Invalid new email address format' });
      }

      // Check if new email conflicts with another user
      const conflictRes = await query("SELECT id FROM users WHERE email = $1 AND id != $2", [cleanNewEmail, adminId]);
      if (conflictRes.rows.length > 0) {
        return res.status(409).json({ error: 'This email is already in use by another account' });
      }
      updatedEmail = cleanNewEmail;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }
      updatedHash = await hashPassword(newPassword);
    }

    // 4. Save to Database
    const now = Date.now();
    if (dbAdmin) {
      await query(
        `UPDATE users SET email = $1, password_hash = $2, updated_at = $3 WHERE role = 'admin' AND (id = $4 OR email = $5)`,
        [updatedEmail, updatedHash, now, adminId, currentEmail]
      );
    } else {
      await query(
        `INSERT INTO users (id, email, password_hash, name, phone, role, is_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'admin', true, $6, $6)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = EXCLUDED.updated_at`,
        [adminId, updatedEmail, updatedHash, 'Super Admin', '+92 42 111 743 374', now]
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Admin credentials updated successfully. Please log in with your new credentials.',
      user: {
        id: adminId,
        email: updatedEmail,
        name: dbAdmin?.name || 'Super Admin',
        role: 'admin',
      },
    });
  } catch (error) {
    console.error('Update admin credentials error:', error);
    res.status(500).json({ error: 'Failed to update admin credentials' });
  }
});

/**
 * GET /api/v1/admin/feedback
 * Query: page?, limit?, search?, category?
 * Description: Retrieves paginated user and driver feedback with search and filter support.
 */
router.get('/feedback', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = (req.query.search as string || '').trim();
    const category = req.query.category as string;

    const offset = (page - 1) * limit;

    let queryStr = `
      SELECT f.*, u.phone as user_phone, u.email as user_email
       FROM feedbacks f
       LEFT JOIN users u ON f.user_id = u.id
       WHERE 1=1`;

    const params: any[] = [];

    if (category && category !== 'all') {
      params.push(category);
      queryStr += ` AND f.category = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      queryStr += ` AND (LOWER(f.user_name) LIKE $${params.length} OR LOWER(f.user_phone) LIKE $${params.length} OR LOWER(f.user_email) LIKE $${params.length} OR LOWER(f.comment) LIKE $${params.length})`;
    }

    // Get total count for pagination
    let countQueryStr = `SELECT COUNT(*) as total FROM feedbacks f LEFT JOIN users u ON f.user_id = u.id WHERE 1=1`;
    const countParams: any[] = [];
    if (category && category !== 'all') {
      countParams.push(category);
      countQueryStr += ` AND f.category = $${countParams.length}`;
    }
    if (search) {
      countParams.push(`%${search.toLowerCase()}%`);
      countQueryStr += ` AND (LOWER(f.user_name) LIKE $${countParams.length} OR LOWER(f.user_phone) LIKE $${countParams.length} OR LOWER(f.user_email) LIKE $${countParams.length} OR LOWER(f.comment) LIKE $${countParams.length})`;
    }
    const countResult = await query(countQueryStr, countParams);
    const total = countResult.rows && countResult.rows.length > 0 ? parseInt(countResult.rows[0].total || '0', 10) : 0;

    // Get paginated data
    queryStr += ` ORDER BY f.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const feedbackResult = await query(queryStr, params);

    // Stats query (always fetch full stats)
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_feedback,
        AVG(rating)::numeric(10,2) as avg_rating,
        COUNT(CASE WHEN user_role = 'driver' THEN 1 END) as driver_feedback_count,
        COUNT(CASE WHEN user_role = 'passenger' THEN 1 END) as passenger_feedback_count
       FROM feedbacks`
    );

    res.status(200).json({
      feedbacks: feedbackResult.rows,
      stats: statsResult.rows[0] || {
        total_feedback: 0,
        avg_rating: 5.0,
        driver_feedback_count: 0,
        passenger_feedback_count: 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin fetch feedback error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback logs' });
  }
});

/**
 * GET /api/v1/admin/audit-logs
 * Query: page?, limit?, search?, action?
 * Description: Retrieves paginated admin audit logs with search and filter support.
 */
router.get('/audit-logs', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = (req.query.search as string || '').trim();
    const action = req.query.action as string;

    const offset = (page - 1) * limit;

    let queryStr = `
      SELECT al.*, u.email as admin_email, u.name as admin_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE 1=1`;

    const params: any[] = [];

    if (action && action !== 'all') {
      params.push(action);
      queryStr += ` AND al.action = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      queryStr += ` AND (LOWER(al.action) LIKE $${params.length} OR LOWER(al.details) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`;
    }

    // Get total count for pagination
    let countQueryStr = `SELECT COUNT(*) as total FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE 1=1`;
    const countParams: any[] = [];
    if (action && action !== 'all') {
      countParams.push(action);
      countQueryStr += ` AND al.action = $${countParams.length}`;
    }
    if (search) {
      countParams.push(`%${search.toLowerCase()}%`);
      countQueryStr += ` AND (LOWER(al.action) LIKE $${countParams.length} OR LOWER(al.details) LIKE $${countParams.length} OR LOWER(u.email) LIKE $${countParams.length})`;
    }
    const countResult = await query(countQueryStr, countParams);
    const total = countResult.rows && countResult.rows.length > 0 ? parseInt(countResult.rows[0].total || '0', 10) : 0;

    // Get paginated data (newest first)
    queryStr += ` ORDER BY al.timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const logsResult = await query(queryStr, params);

    res.status(200).json({
      logs: logsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin fetch audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * GET /api/v1/admin/support/tickets
 * Query: page?, limit?, search?, status?
 * Description: Retrieves paginated support tickets with search and filter support.
 */
router.get('/support/tickets', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = (req.query.search as string || '').trim();
    const status = req.query.status as string;

    const offset = (page - 1) * limit;

    let queryStr = `
      SELECT st.*, u.name as user_name, u.phone as user_phone, u.email as user_email
       FROM support_tickets st
       LEFT JOIN users u ON st.user_id = u.id
       WHERE 1=1`;

    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(status);
      queryStr += ` AND st.status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      queryStr += ` AND (LOWER(st.subject) LIKE $${params.length} OR LOWER(st.category) LIKE $${params.length} OR LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`;
    }

    // Get total count for pagination
    let countQueryStr = `SELECT COUNT(*) as total FROM support_tickets st LEFT JOIN users u ON st.user_id = u.id WHERE 1=1`;
    const countParams: any[] = [];
    if (status && status !== 'all') {
      countParams.push(status);
      countQueryStr += ` AND st.status = $${countParams.length}`;
    }
    if (search) {
      countParams.push(`%${search.toLowerCase()}%`);
      countQueryStr += ` AND (LOWER(st.subject) LIKE $${countParams.length} OR LOWER(st.category) LIKE $${countParams.length} OR LOWER(u.name) LIKE $${countParams.length} OR LOWER(u.email) LIKE $${countParams.length})`;
    }
    const countResult = await query(countQueryStr, countParams);
    const total = countResult.rows && countResult.rows.length > 0 ? parseInt(countResult.rows[0].total || '0', 10) : 0;

    // Get paginated data
    queryStr += ` ORDER BY st.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const ticketsResult = await query(queryStr, params);

    res.status(200).json({
      tickets: ticketsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin fetch support tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch support tickets' });
  }
});

/**
 * PUT /api/v1/admin/support/tickets/:id/status
 * Body: { status: 'open' | 'in_progress' | 'resolved' }
 * Description: Updates support ticket status.
 */
router.put('/support/tickets/:id/status', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['open', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be open, in_progress, or resolved' });
    }

    await query('UPDATE support_tickets SET status = $1 WHERE id = $2', [status, id]);

    // If resolved, notify the ticket owner
    if (status === 'resolved') {
      try {
        const ticketRes = await query('SELECT user_id, subject FROM support_tickets WHERE id = $1', [id]);
        if (ticketRes.rows.length > 0 && ticketRes.rows[0].user_id) {
          const ticketOwner = ticketRes.rows[0].user_id;
          const subject = ticketRes.rows[0].subject || 'Support Ticket';
          const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          
          query(
            `INSERT INTO user_notifications (id, user_id, title, message, category, is_read, created_at)
             VALUES ($1, $2, $3, $4, 'system', false, $5)`,
            [notifId, ticketOwner, 'Support Ticket Resolved', `Your support ticket regarding "${subject}" has been marked as resolved.`, Date.now()]
          ).catch((e: any) => console.warn('Ticket resolved notification write failed:', e?.message));

          sendPushNotification({
            userId: ticketOwner,
            title: 'Support Ticket Resolved',
            body: `Your support ticket regarding "${subject}" has been marked as resolved.`,
            data: { type: 'TICKET_RESOLVED', ticketId: id },
          }).catch((e: any) => console.warn('Ticket resolved push failed:', e?.message));
        }
      } catch (e: any) {
        console.warn('Ticket notification error (non-critical):', e?.message);
      }
    }

    // Audit log entry
    query(
      'INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [`log_${Date.now()}`, (req as any).user.id, 'UPDATE_TICKET_STATUS', `Updated ticket ${id} status to ${status}`, Date.now()]
    ).catch((e: any) => console.warn('Audit log write failed (non-critical):', e?.message));

    res.status(200).json({ success: true, message: 'Ticket status updated successfully' });
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({ error: 'Failed to update ticket status' });
  }
});

/**
 * GET /api/v1/admin/users/deactivated
 * Query: page?, limit?, search?
 * Description: Retrieves paginated list of deactivated accounts with search support.
 */
router.get('/users/deactivated', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = (req.query.search as string || '').trim();

    const offset = (page - 1) * limit;

    let queryStr = `
      SELECT u.id, u.name, u.phone, u.email, u.role, u.cnic, u.deactivation_reason, u.deactivated_at, u.created_at
       FROM users u
       WHERE u.is_active = false`;

    const params: any[] = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      queryStr += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(u.phone) LIKE $${params.length})`;
    }

    // Get total count for pagination
    let countQueryStr = `SELECT COUNT(*) as total FROM users u WHERE u.is_active = false`;
    const countParams: any[] = [];
    if (search) {
      countParams.push(`%${search.toLowerCase()}%`);
      countQueryStr += ` AND (LOWER(u.name) LIKE $${countParams.length} OR LOWER(u.email) LIKE $${countParams.length} OR LOWER(u.phone) LIKE $${countParams.length})`;
    }
    const countResult = await query(countQueryStr, countParams);
    const total = countResult.rows && countResult.rows.length > 0 ? parseInt(countResult.rows[0].total || '0', 10) : 0;

    // Get paginated data
    queryStr += ` ORDER BY u.deactivated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);

    res.status(200).json({
      deactivatedAccounts: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Fetch deactivated accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch deactivated accounts' });
  }
});

/**
 * PUT /api/v1/admin/users/:id/reactivate
 * Description: Reactivates a deactivated user account.
 */
router.put('/users/:id/reactivate', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const userCheck = await query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await query(
      'UPDATE users SET is_active = true, deactivation_reason = NULL, deactivated_at = NULL, updated_at = $1 WHERE id = $2',
      [Date.now(), id]
    );

    // If driver, ensure they are offline initially
    await query('UPDATE drivers SET is_online = false, is_available = false WHERE driver_id = $1', [id]).catch(() => {});

    // Audit log entry
    query(
      'INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [`log_${Date.now()}`, (req as any).user.id, 'REACTIVATE_ACCOUNT', `Reactivated account ${id}`, Date.now()]
    ).catch((e: any) => console.warn('Audit log write failed (non-critical):', e?.message));

    res.status(200).json({
      success: true,
      message: 'Account reactivated successfully',
    });
  } catch (error) {
    console.error('Reactivate account error:', error);
    res.status(500).json({ error: 'Failed to reactivate account' });
  }
});

/**
 * GET /api/v1/admin/rides/history
 * Query: page?, limit?, status?, startDate?, endDate?
 * Description: Retrieves paginated ride history with filters and explicit column projection.
 */
router.get('/rides/history', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const offset = (page - 1) * limit;

    let queryStr = `
      SELECT r.ride_id, r.passenger_id, r.driver_id, r.status, r.pickup_latitude, r.pickup_longitude,
             r.pickup_address, r.dropoff_latitude, r.dropoff_longitude, r.dropoff_address,
             r.estimated_fare, r.offered_fare, r.final_fare, r.payment_method, r.vehicle_category,
             r.created_at, r.completed_at, r.cancelled_at, r.cancellation_reason,
             pu.name as passenger_name, pu.phone as passenger_phone,
             du.name as driver_name, du.phone as driver_phone
       FROM rides r
       JOIN users pu ON r.passenger_id = pu.id
       LEFT JOIN users du ON r.driver_id = du.id
       WHERE r.status IN ('completed', 'cancelled')`;

    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(status);
      queryStr += ` AND r.status = $${params.length}`;
    }

    if (startDate) {
      params.push(parseInt(startDate));
      queryStr += ` AND r.created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(parseInt(endDate));
      queryStr += ` AND r.created_at <= $${params.length}`;
    }

    // Get total count for pagination
    let countQueryStr = `SELECT COUNT(*) as total FROM rides r WHERE r.status IN ('completed', 'cancelled')`;
    const countParams: any[] = [];
    if (status && status !== 'all') {
      countParams.push(status);
      countQueryStr += ` AND r.status = $${countParams.length}`;
    }
    if (startDate) {
      countParams.push(parseInt(startDate));
      countQueryStr += ` AND r.created_at >= $${countParams.length}`;
    }
    if (endDate) {
      countParams.push(parseInt(endDate));
      countQueryStr += ` AND r.created_at <= $${countParams.length}`;
    }
    const countResult = await query(countQueryStr, countParams);
    const total = countResult.rows && countResult.rows.length > 0 ? parseInt(countResult.rows[0].total || '0', 10) : 0;

    // Get paginated data
    queryStr += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const ridesResult = await query(queryStr, params);

    res.status(200).json({
      rides: ridesResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Fetch ride history error:', error);
    res.status(500).json({ error: 'Failed to fetch ride history' });
  }
});

/**
 * POST /api/v1/admin/notifications/send
 * Body: { title: string, body: string, target: 'all' | 'drivers' | 'passengers' | 'specific', userId?: string }
 * Description: Sends admin notifications to targeted users (push + in-app notification center).
 */
router.post('/notifications/send', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, body, target, userId } = req.body;

    if (!title || !body || !target) {
      return res.status(400).json({ error: 'Title, body, and target are required' });
    }

    if (!['all', 'drivers', 'passengers', 'specific'].includes(target)) {
      return res.status(400).json({ error: 'Invalid target. Must be all, drivers, passengers, or specific' });
    }

    if (target === 'specific' && !userId) {
      return res.status(400).json({ error: 'userId is required when target is specific' });
    }

    let recipients: string[] = [];

    if (target === 'specific') {
      recipients = [userId];
    } else if (target === 'drivers') {
      const driversRes = await query('SELECT driver_id FROM drivers WHERE is_online = true OR is_available = true LIMIT 500');
      recipients = driversRes.rows.map((r: any) => r.driver_id);
    } else if (target === 'passengers') {
      const passengersRes = await query('SELECT id FROM users WHERE role = \'passenger\' LIMIT 500');
      recipients = passengersRes.rows.map((r: any) => r.id);
    } else {
      // all - fetch both drivers and passengers (limited to avoid spam)
      const driversRes = await query('SELECT driver_id FROM drivers LIMIT 500');
      const passengersRes = await query('SELECT id FROM users WHERE role = \'passenger\' LIMIT 500');
      recipients = [
        ...driversRes.rows.map((r: any) => r.driver_id),
        ...passengersRes.rows.map((r: any) => r.id)
      ];
    }

    // 1. Send in-app notifications (saved to database for mobile NotificationCenter)
    const now = Date.now();
    for (const recipientId of recipients) {
      const notifId = `notif_${now}_${Math.random().toString(36).substring(2, 7)}`;
      query(
        `INSERT INTO user_notifications (id, user_id, title, message, category, is_read, created_at)
         VALUES ($1, $2, $3, $4, 'system', false, $5)`,
        [notifId, recipientId, title, body, now]
      ).catch((e: any) => console.warn('In-app notification write failed:', e?.message));
    }

    // 2. Send push notifications via FCM (non-blocking, continue even if some fail)
    const sendPromises = recipients.map((recipientId) =>
      sendPushNotification({
        userId: recipientId,
        title,
        body,
        data: { type: 'ADMIN_NOTIFICATION', target },
      }).catch(err => console.warn(`[FCM] Failed to send to ${recipientId}:`, err))
    );

    await Promise.allSettled(sendPromises);

    // Audit log entry
    query(
      'INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [`log_${Date.now()}`, (req as any).user.id, 'SEND_ADMIN_NOTIFICATION', `Sent notification to ${target} (${recipients.length} recipients): ${title}`, Date.now()]
    ).catch((e: any) => console.warn('Audit log write failed (non-critical):', e?.message));

    res.status(200).json({
      success: true,
      message: `Notification sent to ${recipients.length} recipients`,
      recipientsCount: recipients.length,
    });
  } catch (error) {
    console.error('Send admin notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * GET /api/v1/admin/system/health-deep
 * Description: Retrieves deep diagnostic telemetry including DB latency, memory, uptime, and gateway status.
 */
router.get('/system/health-deep', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    let dbConnected = true;
    let dbError: string | null = null;
    let latencyMs = 0;

    try {
      await query('SELECT 1');
      latencyMs = Date.now() - startTime;
    } catch (e: any) {
      dbConnected = false;
      dbError = e?.message || 'Database ping failed';
    }

    const mem = process.memoryUsage();
    const hasGmail = Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);
    const hasFCM = Boolean(process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_CLIENT_EMAIL);
    const hasCloudinary = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY);

    res.status(200).json({
      status: dbConnected ? 'healthy' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: Date.now(),
      database: {
        connected: dbConnected,
        latencyMs,
        engine: 'PostgreSQL TCP Pool / Supabase Fallback',
        error: dbError,
      },
      services: {
        firebaseFCM: hasFCM ? 'configured' : 'mock_fallback',
        gmailSMTP: hasGmail ? 'configured' : 'unconfigured',
        cloudinary: hasCloudinary ? 'configured' : 'unconfigured',
      },
      memory: {
        heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
        heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
        rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      },
    });
  } catch (error: any) {
    console.error('Deep health check error:', error);
    res.status(500).json({ error: 'Failed to retrieve system health diagnostics' });
  }
});

/**
 * POST /api/v1/admin/users/:id/warn
 * Body: { warningType: 'cancellation_rate' | 'policy_violation' | 'behavior', message: string }
 * Description: Issues an official policy warning to a driver or passenger without blocking the account.
 */
router.post('/users/:id/warn', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id: targetUserId } = req.params;
    const { warningType, message } = req.body;

    const validTypes = ['cancellation_rate', 'policy_violation', 'behavior'];
    if (!warningType || !validTypes.includes(warningType)) {
      return res.status(400).json({ error: `Warning type must be one of: ${validTypes.join(', ')}` });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Warning message is required' });
    }

    // Verify user existence
    const userRes = await query('SELECT id, name, role, email, phone FROM users WHERE id = $1', [targetUserId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRes.rows[0];
    const now = Date.now();
    const warningTitle = warningType === 'cancellation_rate'
      ? '⚠️ SheDrive Notice: Excessive Cancellation Rate'
      : (warningType === 'behavior' ? '⚠️ SheDrive Community Guidelines Notice' : '⚠️ SheDrive Official Policy Notice');

    const notifId = `notif_warn_${now}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. In-app notification write
    await query(
      `INSERT INTO user_notifications (id, user_id, title, message, category, is_read, created_at)
       VALUES ($1, $2, $3, $4, 'safety', false, $5)`,
      [notifId, targetUserId, warningTitle, message.trim(), now]
    ).catch((e: any) => console.warn('Warning notification DB write error:', e?.message));

    // 2. Push notification
    sendPushNotification({
      userId: targetUserId,
      title: warningTitle,
      body: message.trim(),
      data: { type: 'POLICY_WARNING', warningType },
    }).catch(err => console.warn('[FCM] Warning push error:', err?.message));

    // 3. Audit log entry
    const auditId = `log_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const adminUser = (req as any).user;
    const auditDetails = `Issued official warning (${warningType}) to User ${user.name} (${targetUserId}, ${user.role}). Message: "${message.trim()}"`;

    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [auditId, adminUser?.id || 'admin', 'ISSUE_USER_WARNING', auditDetails, now]
    ).catch((e: any) => console.warn('Warning audit log write error:', e?.message));

    res.status(200).json({
      success: true,
      message: `Official warning issued to ${user.name}`,
      userId: targetUserId,
      warningType,
    });
  } catch (error: any) {
    console.error('Issue user warning error:', error);
    res.status(500).json({ error: 'Failed to issue user warning' });
  }
});

export default router;

