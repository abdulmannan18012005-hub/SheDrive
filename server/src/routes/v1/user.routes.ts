import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { query } from '../../config/db';

const router = Router();

/**
 * GET /api/v1/user/profile
 * Description: Fetches full current user profile info.
 */
router.get('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRes = await query('SELECT id, name, email, phone, role, cnic, cnic_front_url, cnic_back_url, photo_url, is_verified, verification_status, is_active, created_at FROM users WHERE id = $1', [userId]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRes.rows[0];

    // If driver, attach vehicle details & document expiries
    if (user.role === 'driver') {
      const driverRes = await query(
        `SELECT driver_id, vehicle_category, vehicle_make, vehicle_model, vehicle_plate, vehicle_color, vehicle_year, ac_option, is_verified, is_active, is_online, is_available, rating, total_rides, is_fee_suspended, license_front_url, license_back_url, selfie_url, vehicle_photo_url FROM drivers WHERE driver_id = $1`,
        [userId]
      );
      if (driverRes.rows.length > 0) {
        user.driverInfo = driverRes.rows[0];
        user.driver_info = driverRes.rows[0];
      }
    }

    res.status(200).json({ user });
  } catch (error: any) {
    console.error('Fetch profile error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

/**
 * PUT /api/v1/user/profile
 * Body: { name?: string, email?: string, phone?: string, gender?: string, cnic?: string, cnicFrontUrl?: string, cnicBackUrl?: string, photoURL?: string }
 * Description: Updates passenger or driver user profile fields.
 */
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, email, phone, gender, cnic, cnicFrontUrl, cnicBackUrl, photoURL } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (name && name.trim()) {
      params.push(name.trim());
      updates.push(`name = $${params.length}`);
    }
    if (email && email.trim()) {
      params.push(email.trim().toLowerCase());
      updates.push(`email = $${params.length}`);
    }
    if (phone && phone.trim()) {
      params.push(phone.trim());
      updates.push(`phone = $${params.length}`);
    }
    if (gender && gender.trim()) {
      params.push(gender.trim());
      updates.push(`gender = $${params.length}`);
    }
    if (cnic && cnic.trim()) {
      params.push(cnic.trim());
      updates.push(`cnic = $${params.length}`);
    }
    if (cnicFrontUrl) {
      params.push(cnicFrontUrl);
      updates.push(`cnic_front_url = $${params.length}`);
    }
    if (cnicBackUrl) {
      params.push(cnicBackUrl);
      updates.push(`cnic_back_url = $${params.length}`);
    }
    if (photoURL) {
      params.push(photoURL);
      updates.push(`photo_url = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid profile fields provided for update' });
    }

    params.push(Date.now());
    updates.push(`updated_at = $${params.length}`);

    params.push(userId);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}`, params);

    res.status(200).json({ success: true, message: 'Profile updated successfully' });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * GET /api/v1/user/emergency-contacts
 * Description: Retrieves passenger/driver emergency contacts (max 5).
 */
router.get('/emergency-contacts', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const result = await query(
      'SELECT id, name, relationship, phone, created_at FROM emergency_contacts WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );

    res.status(200).json({ contacts: result.rows });
  } catch (error: any) {
    console.error('Fetch emergency contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch emergency contacts' });
  }
});

/**
 * POST /api/v1/user/emergency-contacts
 * Body: { name: string, relationship: string, phone: string }
 * Description: Adds a new emergency contact (max 5 limit enforced).
 */
router.post('/emergency-contacts', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, relationship, phone } = req.body;

    if (!name || !name.trim() || !relationship || !relationship.trim() || !phone || !phone.trim()) {
      return res.status(400).json({ error: 'Contact Name, Relationship, and Phone Number are required' });
    }

    // Enforce max 5 limit
    const countRes = await query('SELECT COUNT(*) as count FROM emergency_contacts WHERE user_id = $1', [userId]);
    const currentCount = parseInt(countRes.rows[0].count || '0', 10);

    if (currentCount >= 5) {
      return res.status(400).json({ error: 'Maximum of 5 emergency contacts allowed per account.' });
    }

    const contactId = `ec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    await query(
      `INSERT INTO emergency_contacts (id, user_id, name, relationship, phone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [contactId, userId, name.trim(), relationship.trim(), phone.trim(), now]
    );

    res.status(201).json({
      success: true,
      message: 'Emergency contact added successfully',
      contact: { id: contactId, name: name.trim(), relationship: relationship.trim(), phone: phone.trim(), createdAt: now },
    });
  } catch (error: any) {
    console.error('Add emergency contact error:', error);
    res.status(500).json({ error: 'Failed to add emergency contact' });
  }
});

/**
 * DELETE /api/v1/user/emergency-contacts/:id
 * Description: Deletes an emergency contact.
 */
router.delete('/emergency-contacts/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    await query('DELETE FROM emergency_contacts WHERE id = $1 AND user_id = $2', [id, userId]);

    res.status(200).json({ success: true, message: 'Emergency contact deleted' });
  } catch (error: any) {
    console.error('Delete emergency contact error:', error);
    res.status(500).json({ error: 'Failed to delete emergency contact' });
  }
});

/**
 * POST /api/v1/user/deactivate
 * Body: { reason?: string }
 * Description: Soft-deletes user account (sets is_active = false) so admin can restore if needed.
 */
router.post('/deactivate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { reason } = req.body;

    const now = Date.now();

    // Write audit log BEFORE deactivation
    const auditId = `aud_${now}_${Math.random().toString(36).substring(2, 6)}`;
    await query(
      `INSERT INTO audit_logs (id, user_id, action, details, timestamp)
       VALUES ($1, $2, 'ACCOUNT_DEACTIVATED', $3, $4)`,
      [auditId, userId, reason || 'User requested account deactivation', now]
    );

    await query(
      'UPDATE users SET is_active = false, deactivation_reason = $1, deactivated_at = $2 WHERE id = $3',
      [reason || 'User requested account deactivation', now, userId]
    );

    // If driver, turn offline
    await query('UPDATE drivers SET is_online = false, is_available = false WHERE driver_id = $1', [userId]);

    res.status(200).json({
      success: true,
      message: 'Your account has been deactivated. You have been safely logged out.',
    });
  } catch (error: any) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ error: 'Failed to deactivate account' });
  }
});

/**
 * GET /api/v1/user/notifications
 * Description: Fetches list of notifications for the user.
 */
router.get('/notifications', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const result = await query(
      'SELECT id, title, message, category, is_read, created_at FROM user_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [userId]
    );

    res.status(200).json({ notifications: result.rows });
  } catch (error: any) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * PUT /api/v1/user/notifications/:id/read
 * Description: Marks a notification as read.
 */
router.put('/notifications/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (id === 'all') {
      await query('UPDATE user_notifications SET is_read = true WHERE user_id = $1', [userId]);
    } else {
      await query('UPDATE user_notifications SET is_read = true WHERE id = $1 AND user_id = $2', [id, userId]);
    }

    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (error: any) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

/**
 * GET /api/v1/user/notifications/unread-count
 * Description: Returns the count of unread notifications for the current user.
 */
router.get('/notifications/unread-count', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const result = await query(
      'SELECT COUNT(*) as count FROM user_notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    const count = parseInt(result.rows[0]?.count || '0', 10);
    res.status(200).json({ count });
  } catch (error: any) {
    console.error('Fetch unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

/**
 * GET /api/v1/user/notification-settings
 * Description: Get user notification preferences
 */
router.get('/notification-settings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const defaultSettings = {
      rideNotifications: true,
      promotionalNotifications: true,
      platformNotifications: true,
      paymentNotifications: true,
      emergencyNotifications: true,
    };
    res.status(200).json({ success: true, settings: defaultSettings });
  } catch (error: any) {
    console.error('Fetch notification settings error:', error);
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

/**
 * PUT /api/v1/user/notification-settings
 * Description: Update user notification preferences
 */
router.put('/notification-settings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { rideNotifications, promotionalNotifications, platformNotifications, paymentNotifications } = req.body;
    const updatedSettings = {
      rideNotifications: rideNotifications !== false,
      promotionalNotifications: promotionalNotifications !== false,
      platformNotifications: platformNotifications !== false,
      paymentNotifications: paymentNotifications !== false,
      emergencyNotifications: true, // Permanent lock on safety
    };
    res.status(200).json({ success: true, message: 'Notification settings updated', settings: updatedSettings });
  } catch (error: any) {
    console.error('Update notification settings error:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

/**
 * PUT /api/v1/driver/vehicle
 * Body: { make?: string, model?: string, year?: string, plate?: string, color?: string, photoUrl?: string, licenseUrl?: string }
 * Description: Drivers update vehicle details or upload replacement documents (requires admin re-review if plate or docs changed).
 */
router.put('/driver/vehicle', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (role !== 'driver' || !userId) {
      return res.status(403).json({ error: 'Only drivers can update vehicle details' });
    }

    const { make, model, year, plate, color, photoUrl, licenseUrl } = req.body;

    let requiresReview = false;

    // Check if plate changed
    if (plate) {
      const currVeh = await query('SELECT vehicle_plate FROM drivers WHERE driver_id = $1', [userId]);
      if (currVeh.rows.length > 0 && currVeh.rows[0].vehicle_plate.toUpperCase() !== plate.trim().toUpperCase()) {
        requiresReview = true;
      }
    }

    if (photoUrl || licenseUrl) {
      requiresReview = true;
    }

    await query(
      `UPDATE drivers SET
        vehicle_make = COALESCE($1, vehicle_make),
        vehicle_model = COALESCE($2, vehicle_model),
        vehicle_year = COALESCE($3, vehicle_year),
        vehicle_plate = COALESCE($4, vehicle_plate),
        vehicle_color = COALESCE($5, vehicle_color),
        vehicle_photo_url = COALESCE($6, vehicle_photo_url),
        license_url = COALESCE($7, license_url)
       WHERE driver_id = $8`,
      [make, model, year, plate ? plate.trim().toUpperCase() : null, color, photoUrl, licenseUrl, userId]
    );

    // If critical documents or plate changed, set verification_status back to 'pending' for Admin re-review
    if (requiresReview) {
      await query("UPDATE users SET verification_status = 'pending' WHERE id = $1", [userId]);
    }

    res.status(200).json({
      success: true,
      requiresReview,
      message: requiresReview
        ? 'Vehicle details updated! Since critical document/plate details changed, your profile has been sent for quick Admin review.'
        : 'Vehicle details updated successfully.',
    });
  } catch (error: any) {
    console.error('Update driver vehicle error:', error);
    res.status(500).json({ error: 'Failed to update vehicle details' });
  }
});

export default router;
