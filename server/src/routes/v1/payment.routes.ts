import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { query } from '../../config/db';
import { sendPushNotification } from '../../services/notificationService';
import { requireAdmin } from '../v1/admin.routes';
import { paymentRateLimiter } from '../../middleware/rateLimiter';

const router = Router();

// Bank / Digital Wallet Transfer Details for Platform Fee Payments
const PAYMENT_INSTRUCTIONS = {
  bankName: 'Meezan Bank & JazzCash',
  accountTitle: 'SheDrive Operations Account',
  accountNumber: '0300-1234567 / PK92MEZN0009988776655',
  instructions: 'Transfer the 5% platform fee to the account above via JazzCash, EasyPaisa, or Bank App. Then enter the Transaction ID and upload your receipt screenshot below.',
};

/**
 * GET /api/v1/payments/driver/monthly
 * Query: month? (YYYY-MM)
 * Description: Calculates and returns driver's monthly earnings, 5% fee, payment status, countdown, and submission history.
 */
router.get('/driver/monthly', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (role !== 'driver' || !userId) {
      return res.status(403).json({ error: 'Only drivers can access monthly platform fee information' });
    }

    // Determine target month (YYYY-MM). Default to current month if not specified.
    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const requestedMonthYear = (req.query.month as string) || currentMonthYear;

    // Calculate total completed rides & earnings from PostgreSQL rides table for the requested month
    // Only include drivers who are approved (verification_status = 'approved')
    const ridesRes = await query(
      `SELECT COUNT(*) as total_rides, 
              COALESCE(SUM(COALESCE(final_fare, offered_fare, estimated_fare)), 0) as total_earnings
       FROM rides r
       JOIN users u ON r.driver_id = u.id
       WHERE r.driver_id = $1 
         AND r.status = 'completed'
         AND u.verification_status = 'approved'
         AND TO_CHAR(TO_TIMESTAMP(r.created_at / 1000.0), 'YYYY-MM') = $2`,
      [userId, requestedMonthYear]
    );

    const totalRides = parseInt(ridesRes.rows[0].total_rides || '0', 10);
    const totalEarnings = parseFloat(ridesRes.rows[0].total_earnings || '0');

    // Fetch dynamic commission rate and payment details from admin_settings
    const settingsRes = await query('SELECT commission_pct, raast_id, raast_qr_url, bank_account_number, iban FROM admin_settings WHERE id = 1');
    const settingsRow = settingsRes.rows[0] || {};
    const commissionPct = parseFloat(settingsRow.commission_pct || '5.0') / 100;
    const platformFee = Math.round(totalEarnings * commissionPct * 100) / 100;

    // Due date calculation: 4th of the following month
    const [yearStr, monthStr] = requestedMonthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const nextMonthDate = new Date(year, month, 4, 23, 59, 59); // 4th of next month 23:59:59
    const dueDateTimestamp = nextMonthDate.getTime();

    // Check existing monthly_payments database record
    const paymentRes = await query(
      'SELECT * FROM monthly_payments WHERE driver_id = $1 AND month_year = $2',
      [userId, requestedMonthYear]
    );

    let paymentRecord = paymentRes.rows[0];

    // If no record exists yet, create an initial record
    if (!paymentRecord) {
      const recordId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const initialStatus = totalEarnings === 0 ? 'paid' : (Date.now() > dueDateTimestamp ? 'overdue' : 'pending');
      const nowMs = Date.now();

      await query(
        `INSERT INTO monthly_payments (
          id, driver_id, month_year, total_rides, total_earnings, platform_fee,
          due_date, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (driver_id, month_year) DO NOTHING`,
        [recordId, userId, requestedMonthYear, totalRides, totalEarnings, platformFee, dueDateTimestamp, initialStatus, nowMs, nowMs]
      );

      const refreshed = await query('SELECT * FROM monthly_payments WHERE driver_id = $1 AND month_year = $2', [userId, requestedMonthYear]);
      paymentRecord = refreshed.rows[0];
    } else {
      // Update calculated rides/earnings if pending
      if (paymentRecord.status === 'pending' || paymentRecord.status === 'overdue') {
        const isOverdue = Date.now() > dueDateTimestamp && totalEarnings > 0 && paymentRecord.status !== 'paid';
        const newStatus = isOverdue ? 'overdue' : paymentRecord.status;

        await query(
          `UPDATE monthly_payments 
           SET total_rides = $1, total_earnings = $2, platform_fee = $3, status = $4, updated_at = $5
           WHERE id = $6`,
          [totalRides, totalEarnings, platformFee, newStatus, Date.now(), paymentRecord.id]
        );
        paymentRecord.total_rides = totalRides;
        paymentRecord.total_earnings = totalEarnings;
        paymentRecord.platform_fee = platformFee;
        paymentRecord.status = newStatus;
      }
    }

    // Check if driver is suspended due to overdue payment
    const isOverdue = Date.now() > dueDateTimestamp && totalEarnings > 0 && paymentRecord.status !== 'paid' && paymentRecord.status !== 'submitted';
    if (isOverdue && paymentRecord.status === 'overdue') {
      await query('UPDATE drivers SET is_fee_suspended = true WHERE driver_id = $1', [userId]);
    }

    // Calculate countdown seconds remaining until due date
    const remainingMs = Math.max(0, dueDateTimestamp - Date.now());
    const countdownSeconds = Math.floor(remainingMs / 1000);

    // Get payment history for previous months
    const historyRes = await query(
      `SELECT month_year, total_rides, total_earnings, platform_fee, status, transaction_id, receipt_url, submitted_at, reviewed_at
       FROM monthly_payments
       WHERE driver_id = $1
       ORDER BY month_year DESC
       LIMIT 12`,
      [userId]
    );

    res.status(200).json({
      monthYear: requestedMonthYear,
      totalRides: paymentRecord ? parseInt(paymentRecord.total_rides, 10) : totalRides,
      totalEarnings: paymentRecord ? parseFloat(paymentRecord.total_earnings) : totalEarnings,
      platformFee: paymentRecord ? parseFloat(paymentRecord.platform_fee) : platformFee,
      dueDate: dueDateTimestamp,
      status: paymentRecord ? paymentRecord.status : 'pending',
      isOverdue,
      countdownSeconds,
      transactionId: paymentRecord?.transaction_id || '',
      receiptUrl: paymentRecord?.receipt_url || '',
      notes: paymentRecord?.notes || '',
      adminNotes: paymentRecord?.admin_notes || '',
      submittedAt: paymentRecord?.submitted_at || null,
      reviewedAt: paymentRecord?.reviewed_at || null,
      bankDetails: {
        raastId: settingsRow.raast_id || '03001234567',
        raastQrUrl: settingsRow.raast_qr_url || '',
        bankAccountNumber: settingsRow.bank_account_number || 'PK92MEZN0009988776655',
        iban: settingsRow.iban || 'PK92MEZN000998877665544332211',
        bankName: 'Meezan Bank & Raast',
        accountTitle: 'SheDrive Operations Account',
        instructions: 'Transfer your monthly platform fee using Raast ID, QR Code, or Bank Account / IBAN, then enter your Transaction ID and upload your receipt screenshot below.',
      },
      history: historyRes.rows,
    });
  } catch (error: any) {
    console.error('Fetch driver monthly fee error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly platform fee information' });
  }
});

/**
 * POST /api/v1/payments/driver/submit
 * Body: { monthYear: string, transactionId: string, receiptUrl: string, notes?: string }
 * Description: Submits payment proof (Transaction ID + Screenshot) for admin verification.
 */
router.post('/driver/submit', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { monthYear, transactionId, receiptUrl, notes } = req.body;

    if (role !== 'driver' || !userId) {
      return res.status(403).json({ error: 'Only drivers can submit payment proof' });
    }

    if (!monthYear || !receiptUrl) {
      return res.status(400).json({ error: 'Month and Receipt screenshot are required' });
    }

    const cleanTxId = (transactionId || `TX_${Date.now()}`).trim();

    // Check duplicate transaction ID across other submissions if custom txId supplied (case-insensitive)
    if (transactionId && transactionId.trim()) {
      const dupCheck = await query(
        'SELECT id FROM monthly_payments WHERE LOWER(transaction_id) = LOWER($1) AND driver_id != $2',
        [cleanTxId, userId]
      );

      if (dupCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'This Transaction ID has already been submitted for another payment. Please verify your transaction receipt.',
        });
      }
    }

    // Check existing payment status
    const existing = await query('SELECT id, status FROM monthly_payments WHERE driver_id = $1 AND month_year = $2', [userId, monthYear]);

    const now = Date.now();

    if (existing.rows.length > 0) {
      const record = existing.rows[0];
      if (record.status === 'submitted') {
        return res.status(400).json({
          error: 'Your payment submission is already under review by Admin. Please wait for verification.',
        });
      }

      await query(
        `UPDATE monthly_payments 
         SET transaction_id = $1, receipt_url = $2, notes = $3, status = 'submitted', submitted_at = $4, updated_at = $4
         WHERE id = $5`,
        [cleanTxId, receiptUrl, notes || '', now, record.id]
      );
    } else {
      const recordId = `pay_${now}_${Math.random().toString(36).substring(2, 7)}`;
      const dueDate = new Date();
      dueDate.setDate(4);

      await query(
        `INSERT INTO monthly_payments (
          id, driver_id, month_year, total_rides, total_earnings, platform_fee,
          due_date, status, transaction_id, receipt_url, notes, submitted_at, created_at, updated_at
        ) VALUES ($1, $2, $3, 0, 0, 0, $4, 'submitted', $5, $6, $7, $8, $8, $8)`,
        [recordId, userId, monthYear, dueDate.getTime(), cleanTxId, receiptUrl, notes || '', now]
      );
    }

    res.status(200).json({
      success: true,
      message: 'Payment proof submitted successfully! Admin will review your transaction within 24 hours.',
    });
  } catch (error: any) {
    console.error('Submit monthly payment error:', error);
    res.status(500).json({ error: 'Failed to submit monthly payment proof' });
  }
});

/**
 * GET /api/v1/admin/payments
 * Query: status?, search?, page?, limit?
 * Description: Admin list of all driver monthly payment records with filters & search and pagination.
 */
router.get('/admin/payments', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const offset = (page - 1) * limit;

    let queryStr = `
      SELECT p.*, 
             u.name as driver_name, 
             u.email as driver_email, 
             u.phone as driver_phone, 
             u.verification_status,
             d.vehicle_plate,
             d.vehicle_make,
             d.vehicle_model,
             d.total_rides
      FROM monthly_payments p
      JOIN users u ON p.driver_id = u.id
      JOIN drivers d ON p.driver_id = d.driver_id
      WHERE u.verification_status = 'approved' AND (d.total_rides >= 1 OR p.total_rides >= 1)
    `;

    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(status);
      queryStr += ` AND p.status = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      queryStr += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(u.phone) LIKE $${params.length} OR LOWER(p.transaction_id) LIKE $${params.length} OR LOWER(d.vehicle_plate) LIKE $${params.length})`;
    }

    // Get total count for pagination
    let countQueryStr = `
      SELECT COUNT(*) as total
      FROM monthly_payments p
      JOIN users u ON p.driver_id = u.id
      JOIN drivers d ON p.driver_id = d.driver_id
      WHERE u.verification_status = 'approved' AND (d.total_rides >= 1 OR p.total_rides >= 1)
    `;
    const countParams: any[] = [];

    if (status && status !== 'all') {
      countParams.push(status);
      countQueryStr += ` AND p.status = $${countParams.length}`;
    }

    if (search && search.trim()) {
      countParams.push(`%${search.trim().toLowerCase()}%`);
      countQueryStr += ` AND (LOWER(u.name) LIKE $${countParams.length} OR LOWER(u.email) LIKE $${countParams.length} OR LOWER(u.phone) LIKE $${countParams.length} OR LOWER(p.transaction_id) LIKE $${countParams.length} OR LOWER(d.vehicle_plate) LIKE $${countParams.length})`;
    }

    const countResult = await query(countQueryStr, countParams);
    const total = (countResult.rows && countResult.rows[0] && countResult.rows[0].total)
      ? parseInt(countResult.rows[0].total, 10)
      : 0;

    // Get paginated data
    queryStr += ` ORDER BY p.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);

    res.status(200).json({
      payments: result.rows || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error: any) {
    console.error('Fetch admin monthly payments error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly payments' });
  }
});

/**
 * PUT /api/v1/admin/payments/:id/review
 * Body: { status: 'paid' | 'rejected', adminNotes?: string }
 * Description: Admin approves or rejects driver monthly fee payment.
 */
router.put('/admin/payments/:id/review', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (status !== 'paid' && status !== 'rejected') {
      return res.status(400).json({ error: 'Status must be either "paid" or "rejected"' });
    }

    const payRes = await query('SELECT driver_id, month_year FROM monthly_payments WHERE id = $1', [id]);
    if (payRes.rows.length === 0) {
      return res.status(404).json({ error: 'Monthly payment record not found' });
    }

    const payment = payRes.rows[0];
    const now = Date.now();

    // Update payment record status
    await query(
      `UPDATE monthly_payments
       SET status = $1, admin_notes = $2, reviewed_at = $3, updated_at = $3
       WHERE id = $4`,
      [status, adminNotes || '', now, id]
    );

    // If approved ('paid'), lift fee suspension immediately so driver can go online
    if (status === 'paid') {
      await query('UPDATE drivers SET is_fee_suspended = false WHERE driver_id = $1', [payment.driver_id]);
    }

    // Send push notification to driver
    if (status === 'paid') {
      await sendPushNotification({
        userId: payment.driver_id,
        title: 'Payment Approved ✓',
        body: `Your platform fee payment for ${payment.month_year} has been verified and approved. You can now go online.`,
        data: { type: 'PAYMENT_APPROVED', monthYear: payment.month_year }
      }).catch(err => console.warn('Payment approval notification failed:', err));
    } else if (status === 'rejected') {
      await sendPushNotification({
        userId: payment.driver_id,
        title: 'Payment Rejected ❌',
        body: `Your platform fee payment for ${payment.month_year} was rejected. ${adminNotes ? 'Reason: ' + adminNotes : 'Please re-submit with correct details.'}`,
        data: { type: 'PAYMENT_REJECTED', monthYear: payment.month_year }
      }).catch(err => console.warn('Payment rejection notification failed:', err));
    }

    // Create in-app notification for driver
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const notificationTitle = status === 'paid' ? 'Payment Approved' : 'Payment Rejected';
    const notificationMessage = status === 'paid'
      ? `Your platform fee payment for ${payment.month_year} has been verified and approved.`
      : `Your platform fee payment for ${payment.month_year} was rejected. ${adminNotes ? 'Reason: ' + adminNotes : ''}`;
    await query(
      `INSERT INTO user_notifications (id, user_id, title, message, category, is_read, created_at)
       VALUES ($1, $2, $3, $4, 'payment', false, $5)`,
      [notificationId, payment.driver_id, notificationTitle, notificationMessage, now]
    ).catch(err => console.warn('Payment review in-app notification failed:', err));

    // Audit log entry
    const auditId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const auditAction = status === 'paid' ? 'APPROVE_PAYMENT' : 'REJECT_PAYMENT';
    const auditDetails = `${auditAction} payment ${id} for driver ${payment.driver_id} month ${payment.month_year}. ${adminNotes ? 'Notes: ' + adminNotes : ''}`;
    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [auditId, (req as any).user.id, auditAction, auditDetails, now]
    ).catch((e: any) => console.warn('Audit log write failed (non-critical):', e?.message));

    res.status(200).json({
      success: true,
      message: status === 'paid' ? 'Payment approved successfully! Driver suspension removed.' : 'Payment rejected. Driver notified to re-submit.',
    });
  } catch (error: any) {
    console.error('Review admin monthly payment error:', error);
    res.status(500).json({ error: 'Failed to review monthly payment' });
  }
});

/**
 * GET /api/v1/admin/payments/summary
 * Description: Admin overview statistics for Monthly Platform Fees dashboard.
 */
router.get('/admin/payments/summary', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const summaryRes = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.platform_fee ELSE 0 END), 0) as total_platform_income,
        COALESCE(SUM(CASE WHEN p.status = 'submitted' THEN 1 ELSE 0 END), 0) as pending_submissions_count,
        COALESCE(SUM(CASE WHEN p.status = 'paid' THEN 1 ELSE 0 END), 0) as paid_count,
        COALESCE(SUM(CASE WHEN p.status = 'overdue' THEN 1 ELSE 0 END), 0) as overdue_count,
        COALESCE(SUM(p.platform_fee), 0) as expected_income
      FROM monthly_payments p
      JOIN users u ON p.driver_id = u.id
      JOIN drivers d ON p.driver_id = d.driver_id
      WHERE u.verification_status = 'approved' AND (d.total_rides >= 1 OR p.total_rides >= 1)
    `);

    const suspendedRes = await query('SELECT COUNT(*) as count FROM drivers WHERE is_fee_suspended = true');

    const data = (summaryRes.rows && summaryRes.rows[0]) ? summaryRes.rows[0] : {
      total_platform_income: 0,
      pending_submissions_count: 0,
      paid_count: 0,
      overdue_count: 0,
      expected_income: 0,
    };
    const suspendedCount = parseInt((suspendedRes.rows && suspendedRes.rows[0] && suspendedRes.rows[0].count) || '0', 10);

    res.status(200).json({
      totalPlatformIncome: parseFloat(data.total_platform_income || '0'),
      pendingSubmissionsCount: parseInt(data.pending_submissions_count || '0', 10),
      paidCount: parseInt(data.paid_count || '0', 10),
      overdueCount: parseInt(data.overdue_count || '0', 10),
      suspendedDriversCount: suspendedCount,
      expectedIncome: parseFloat(data.expected_income || '0'),
    });
  } catch (error: any) {
    console.error('Fetch admin payment summary error:', error);
    res.status(500).json({ error: 'Failed to fetch platform payment summary' });
  }
});

// ─────────────────────────────────────────────────────────────
// Phase 10: Passenger Payment Gateways (Cash, JazzCash, Easypaisa)
// ─────────────────────────────────────────────────────────────

import { getPaymentGateway, PaymentProvider } from '../../services/payments/paymentGateway';

/**
 * POST /api/v1/payments/passenger/initiate
 * Body: { rideId: string, provider: 'cash' | 'jazzcash' | 'easypaisa', amount: number, mobileAccountNo?: string, customerEmail?: string, idempotencyKey?: string }
 * Description: Initiates passenger payment via Cash or Digital Wallet (JazzCash / Easypaisa Sandbox)
 */
router.post('/passenger/initiate', authenticateToken, paymentRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { rideId, provider, amount, mobileAccountNo, customerEmail, idempotencyKey } = req.body;

    if (!rideId || !provider || amount === undefined || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid rideId, provider, and positive amount are required' });
    }

    if (provider !== 'cash') {
      return res.status(400).json({ error: 'Online passenger payments are disabled. All passenger rides are settled in cash directly with the driver on trip completion.' });
    }

    // Idempotency check
    if (idempotencyKey) {
      const existingTxn = await query(
        'SELECT * FROM payment_transactions WHERE idempotency_key = $1',
        [idempotencyKey]
      );
      if (existingTxn.rows.length > 0) {
        const txn = existingTxn.rows[0];
        return res.status(200).json({
          success: true,
          transactionId: txn.id,
          status: txn.status,
          provider: txn.provider,
          amount: parseFloat(txn.amount),
          currency: txn.currency,
          message: 'Returning existing idempotent transaction',
          isDuplicate: true,
        });
      }
    }

    // Verify ride exists and user has authorization to pay
    const rideRes = await query(
      'SELECT ride_id, passenger_id, driver_id, final_fare, offered_fare, estimated_fare, status FROM rides WHERE ride_id = $1',
      [rideId]
    );
    if (rideRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const ride = rideRes.rows[0];
    if (userRole !== 'admin' && userId !== ride.passenger_id && userId !== ride.driver_id) {
      return res.status(403).json({ error: 'You are not authorized to pay for this ride' });
    }

    // Phase 11: Server-Authoritative Amount Enforcement
    const authoritativeFare = Number(ride.final_fare || ride.offered_fare || ride.estimated_fare || 0);
    const requestedAmount = Number(amount);

    if (authoritativeFare > 0 && Math.abs(requestedAmount - authoritativeFare) > 1.0) {
      return res.status(400).json({
        error: `Payment amount mismatch. Authoritative fare is Rs. ${authoritativeFare}, but requested Rs. ${requestedAmount}`,
        authoritativeFare,
      });
    }

    const effectiveAmount = authoritativeFare > 0 ? authoritativeFare : requestedAmount;

    const gateway = getPaymentGateway(provider);
    const result = await gateway.initiatePayment({
      rideId,
      userId,
      amount: effectiveAmount,
      provider,
      mobileAccountNo,
      customerEmail,
      idempotencyKey,
    });

    // Update ride payment_method in rides table
    await query(
      'UPDATE rides SET payment_method = $1, updated_at = $2 WHERE ride_id = $3',
      [provider, Date.now(), rideId]
    ).catch(e => console.warn('Update ride payment_method notice:', e?.message));

    // Audit log
    const auditId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    query(
      'INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [auditId, userId, 'INITIATE_PAYMENT', `Initiated ${provider} payment for Ride ${rideId} (Amount: Rs. ${amount}, Status: ${result.status})`, Date.now()]
    ).catch(e => console.warn('Audit log write error:', e?.message));

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Initiate passenger payment error:', error);
    res.status(500).json({ error: 'Failed to initiate passenger payment transaction' });
  }
});

/**
 * GET /api/v1/payments/passenger/transactions/:id
 * Description: Verifies and returns status of a specific payment transaction.
 */
router.get('/passenger/transactions/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const resTxn = await query('SELECT * FROM payment_transactions WHERE id = $1', [id]);
    if (resTxn.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const txn = resTxn.rows[0];
    if (userRole !== 'admin' && txn.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden. You cannot view other users payment transactions.' });
    }

    res.status(200).json({
      transactionId: txn.id,
      rideId: txn.ride_id,
      userId: txn.user_id,
      provider: txn.provider,
      amount: parseFloat(txn.amount),
      currency: txn.currency,
      status: txn.status,
      transactionRef: txn.transaction_ref,
      createdAt: parseInt(txn.created_at, 10),
      updatedAt: parseInt(txn.updated_at, 10),
    });
  } catch (error: any) {
    console.error('Fetch transaction error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction details' });
  }
});

/**
 * POST /api/v1/payments/callbacks/jazzcash
 * Description: Webhook IPN handler for JazzCash callbacks with HMAC signature verification.
 */
router.post('/callbacks/jazzcash', async (req: Request, res: Response) => {
  try {
    const gateway = getPaymentGateway('jazzcash');
    const result = await gateway.handleWebhook(req.body, req.headers);

    if (result.success && result.status === 'success') {
      // Find associated ride and notify participants (idempotent notification)
      const txnRes = await query('SELECT status, ride_id, user_id, amount FROM payment_transactions WHERE id = $1 OR transaction_ref = $1', [result.transactionId]);
      if (txnRes.rows.length > 0) {
        const txn = txnRes.rows[0];
        // Only dispatch push notification if not already processed as success
        if (txn.status !== 'success') {
          sendPushNotification({
            userId: txn.user_id,
            title: '💳 Payment Successful',
            body: `Your JazzCash payment of Rs. ${txn.amount} has been verified successfully.`,
            data: { type: 'PAYMENT_SUCCESS', rideId: txn.ride_id, provider: 'jazzcash' },
          }).catch(err => console.warn('[FCM] JazzCash success push error:', err?.message));
        }
      }
    }

    res.status(200).json(result);
  } catch (error: any) {
    console.error('JazzCash callback error:', error);
    res.status(400).json({ error: 'Webhook processing error', details: error?.message });
  }
});

/**
 * POST /api/v1/payments/callbacks/easypaisa
 * Description: Webhook IPN handler for Easypaisa callbacks with SHA-256 signature verification.
 */
router.post('/callbacks/easypaisa', async (req: Request, res: Response) => {
  try {
    const gateway = getPaymentGateway('easypaisa');
    const result = await gateway.handleWebhook(req.body, req.headers);

    if (result.success && result.status === 'success') {
      const txnRes = await query('SELECT status, ride_id, user_id, amount FROM payment_transactions WHERE id = $1 OR transaction_ref = $1', [result.transactionId]);
      if (txnRes.rows.length > 0) {
        const txn = txnRes.rows[0];
        // Only dispatch push notification if not already processed as success
        if (txn.status !== 'success') {
          sendPushNotification({
            userId: txn.user_id,
            title: '💳 Payment Successful',
            body: `Your Easypaisa payment of Rs. ${txn.amount} has been verified successfully.`,
            data: { type: 'PAYMENT_SUCCESS', rideId: txn.ride_id, provider: 'easypaisa' },
          }).catch(err => console.warn('[FCM] Easypaisa success push error:', err?.message));
        }
      }
    }

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Easypaisa callback error:', error);
    res.status(400).json({ error: 'Webhook processing error', details: error?.message });
  }
});

/**
 * GET /api/v1/payments/admin/transactions and GET /api/v1/admin/payments/transactions
 * Query: provider? ('all'|'cash'|'jazzcash'|'easypaisa'), status? ('all'|'pending'|'success'|'failed'), page, limit
 * Description: Admin management endpoint to inspect all passenger digital & cash transactions.
 */
const handleAdminTransactions = async (req: Request, res: Response) => {
  try {
    const provider = (req.query.provider as string) || 'all';
    const status = (req.query.status as string) || 'all';
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
    const offset = (page - 1) * limit;

    let filterSql = 'WHERE 1=1';
    const params: any[] = [];

    if (provider !== 'all') {
      params.push(provider);
      filterSql += ` AND pt.provider = $${params.length}`;
    }

    if (status !== 'all') {
      params.push(status);
      filterSql += ` AND pt.status = $${params.length}`;
    }

    const dataParams = [...params, limit, offset];
    const dataQuery = `
      SELECT 
        pt.id as transaction_id,
        pt.ride_id,
        pt.user_id,
        u.name as user_name,
        u.phone as user_phone,
        pt.provider,
        pt.amount,
        pt.currency,
        pt.transaction_ref,
        pt.status,
        pt.gateway_response,
        pt.created_at,
        pt.updated_at,
        r.pickup_label,
        r.dropoff_label,
        r.vehicle_category
      FROM payment_transactions pt
      LEFT JOIN users u ON pt.user_id = u.id
      LEFT JOIN rides r ON pt.ride_id = r.ride_id
      ${filterSql}
      ORDER BY pt.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM payment_transactions pt
      ${filterSql}
    `;

    const [rowsRes, countRes] = await Promise.all([
      query(dataQuery, dataParams),
      query(countQuery, params),
    ]);

    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      transactions: rowsRes.rows.map((r: any) => ({
        id: r.transaction_id,
        rideId: r.ride_id,
        userId: r.user_id,
        userName: r.user_name || 'Community Rider',
        userPhone: r.user_phone || 'N/A',
        provider: r.provider,
        amount: parseFloat(r.amount || '0'),
        currency: r.currency || 'PKR',
        transactionRef: r.transaction_ref,
        status: r.status,
        createdAt: parseInt(r.created_at, 10),
        updatedAt: parseInt(r.updated_at, 10),
        pickup: r.pickup_label || 'N/A',
        dropoff: r.dropoff_label || 'N/A',
        vehicleTier: r.vehicle_category || 'standard',
        isSandbox: r.gateway_response?.isSandbox ?? true,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Fetch admin transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch payment transactions' });
  }
};

router.get('/admin/transactions', authenticateToken, requireAdmin, handleAdminTransactions);
router.get('/admin/payments/transactions', authenticateToken, requireAdmin, handleAdminTransactions);

export default router;

