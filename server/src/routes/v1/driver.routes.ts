import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { query } from '../../config/db';

const router = Router();

/**
 * PUT /api/v1/driver/online
 * Body: { isOnline: boolean, latitude?: number, longitude?: number, heading?: number }
 * Description: Updates driver online status. Only verified/accepted drivers can go online.
 */
router.put('/online', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { isOnline, latitude, longitude, heading } = req.body;

    if (role !== 'driver') {
      return res.status(403).json({ error: 'Only drivers can update online status' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if driver is verified and approved
    const userResult = await query('SELECT is_verified, verification_status, is_blocked FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const user = userResult.rows[0];

    if (user.is_blocked) {
      return res.status(403).json({ 
        error: 'Your account has been temporarily blocked because it violated our policies.' 
      });
    }

    // Only allow going online if verified and approved by admin
    if (isOnline && (!user.is_verified || user.verification_status !== 'approved')) {
      return res.status(403).json({ 
        error: 'Your driver account documents are currently under review by SheDrive Admin. You will be able to go online once approved.' 
      });
    }

    // Check if driver is fee suspended due to unpaid monthly platform fee
    if (isOnline) {
      const driverFeeRes = await query('SELECT is_fee_suspended FROM drivers WHERE driver_id = $1', [userId]);
      if (driverFeeRes.rows.length > 0 && driverFeeRes.rows[0].is_fee_suspended) {
        return res.status(403).json({
          error: 'Your account has been temporarily suspended because your monthly platform fee has not yet been paid. Please submit payment to continue using SheDrive.',
        });
      }
    }

    // Check shared vehicle constraint: Only ONE driver may use the vehicle at a time
    if (isOnline) {
      const driverVeh = await query('SELECT vehicle_plate FROM drivers WHERE driver_id = $1', [userId]);
      if (driverVeh.rows.length > 0 && driverVeh.rows[0].vehicle_plate) {
        const plate = driverVeh.rows[0].vehicle_plate.trim().toUpperCase();
        if (plate) {
          const activeVehicleRes = await query(
            'SELECT driver_id FROM drivers WHERE UPPER(vehicle_plate) = $1 AND is_online = true AND driver_id != $2',
            [plate, userId]
          );
          if (activeVehicleRes.rows.length > 0) {
            return res.status(403).json({
              error: 'This vehicle is currently in use by another registered driver.',
            });
          }
        }
      }
    }


    // Update driver online status and location
    await query(
      `UPDATE drivers 
       SET is_online = $1, 
           is_available = $1,
           latitude = $2,
           longitude = $3,
           last_location_update = $4
       WHERE driver_id = $5`,
      [
        Boolean(isOnline),
        latitude || null,
        longitude || null,
        Date.now(),
        userId,
      ]
    );

    res.status(200).json({ 
      success: true, 
      isOnline: Boolean(isOnline),
      message: isOnline ? 'You are now online' : 'You are now offline'
    });
  } catch (error) {
    console.error('Update driver online status error:', error);
    res.status(500).json({ error: 'Failed to update online status' });
  }
});

/**
 * GET /api/v1/driver/profile
 * Description: Get current driver profile including verification status
 */
router.get('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (role !== 'driver') {
      return res.status(403).json({ error: 'Only drivers can access this endpoint' });
    }

    const result = await query(
      `SELECT u.id, u.name, u.phone, u.email, u.cnic, u.cnic_front_url, u.cnic_back_url, u.photo_url, u.date_of_birth, u.is_verified, u.is_blocked,
              d.vehicle_category, d.vehicle_make, d.vehicle_model, d.vehicle_plate, d.vehicle_color, d.vehicle_year, d.ac_option,
              d.license_front_url, d.license_back_url, d.selfie_url, d.vehicle_photo_url,
              d.is_online, d.is_available, d.is_active, d.rating, d.total_rides
       FROM users u
       JOIN drivers d ON u.id = d.driver_id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    res.status(200).json({ driver: result.rows[0] });
  } catch (error) {
    console.error('Fetch driver profile error:', error);
    res.status(500).json({ error: 'Failed to fetch driver profile' });
  }
});

/**
 * PUT /api/v1/driver/documents
 * Body: { cnicFrontUrl?, cnicBackUrl?, licenseFrontUrl?, licenseBackUrl?, selfieUrl?, vehiclePhotoUrl?, photoURL? }
 * Description: Update driver verification document URLs and profile picture in database
 */
router.put('/documents', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (role !== 'driver' || !userId) {
      return res.status(403).json({ error: 'Only drivers can update documents' });
    }

    const { cnicFrontUrl, cnicBackUrl, licenseFrontUrl, licenseBackUrl, selfieUrl, vehiclePhotoUrl, acOption, photoURL } = req.body;

    const isDocUpdate = Boolean(cnicFrontUrl || cnicBackUrl || licenseFrontUrl || licenseBackUrl || vehiclePhotoUrl);

    if (cnicFrontUrl || cnicBackUrl || photoURL || isDocUpdate) {
      const uParams: any[] = [];
      const uUpdates: string[] = [];
      if (cnicFrontUrl) {
        uParams.push(cnicFrontUrl);
        uUpdates.push(`cnic_front_url = $${uParams.length}`);
      }
      if (cnicBackUrl) {
        uParams.push(cnicBackUrl);
        uUpdates.push(`cnic_back_url = $${uParams.length}`);
      }
      if (photoURL) {
        uParams.push(photoURL);
        uUpdates.push(`photo_url = $${uParams.length}`);
      }
      if (isDocUpdate) {
        uUpdates.push(`verification_status = 'pending'`);
        uUpdates.push(`is_verified = false`);
      }
      uParams.push(Date.now());
      uUpdates.push(`updated_at = $${uParams.length}`);

      uParams.push(userId);
      await query(`UPDATE users SET ${uUpdates.join(', ')} WHERE id = $${uParams.length}`, uParams);
    }

    if (licenseFrontUrl || licenseBackUrl || selfieUrl || vehiclePhotoUrl || acOption) {
      const dParams: any[] = [];
      const dUpdates: string[] = [];
      if (licenseFrontUrl) {
        dParams.push(licenseFrontUrl);
        dUpdates.push(`license_front_url = $${dParams.length}`);
      }
      if (licenseBackUrl) {
        dParams.push(licenseBackUrl);
        dUpdates.push(`license_back_url = $${dParams.length}`);
      }
      if (selfieUrl) {
        dParams.push(selfieUrl);
        dUpdates.push(`selfie_url = $${dParams.length}`);
      }
      if (vehiclePhotoUrl) {
        dParams.push(vehiclePhotoUrl);
        dUpdates.push(`vehicle_photo_url = $${dParams.length}`);
      }
      if (acOption) {
        dParams.push(acOption);
        dUpdates.push(`ac_option = $${dParams.length}`);
      }
      dParams.push(userId);
      await query(`UPDATE drivers SET ${dUpdates.join(', ')} WHERE driver_id = $${dParams.length}`, dParams);
    }

    res.status(200).json({ success: true, message: 'Driver documents updated successfully and submitted for review' });
  } catch (error) {
    console.error('Update driver documents error:', error);
    res.status(500).json({ error: 'Failed to update driver documents' });
  }
});

export default router;
