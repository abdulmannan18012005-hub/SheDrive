import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query, withTransaction } from '../../config/db';
import { generateToken, hashPassword, comparePassword, authenticateToken } from '../../middleware/auth';
import { supabase } from '../../config/supabase';
import { sendEmail } from '../../services/smtp';
import { buildPasswordResetEmailHtml, buildRegistrationOtpEmailHtml } from '../../utils/emailTemplates';
import { loginRateLimiter, otpRateLimiter, passwordResetRateLimiter } from '../../middleware/rateLimiter';
import { uploadImage, deleteImage } from '../../config/cloudinary';

function extractCloudinaryPublicId(url: string): string | null {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) {
    return null;
  }
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    let pathPart = parts[1];
    pathPart = pathPart.replace(/^v\d+\//, '');
    const dotIndex = pathPart.lastIndexOf('.');
    if (dotIndex !== -1) {
      pathPart = pathPart.substring(0, dotIndex);
    }
    return pathPart;
  } catch {
    return null;
  }
}

const router = Router();

// Helper methods for database-backed verification codes
async function saveVerificationCode(email: string, code: string, type: string, expiresAt: number) {
  const now = Date.now();
  const id = `vc_${now}_${Math.random().toString(36).substring(2, 7)}`;
  // Invalidate previous unused codes for this email and type
  await query('UPDATE user_verification_codes SET used = true WHERE email = $1 AND type = $2', [email, type]);
  await query(
    `INSERT INTO user_verification_codes (id, email, code, type, expires_at, last_sent_at, used, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, email, code, type, expiresAt, now, false, now]
  );
  return id;
}

async function getLatestUnusedCode(email: string, type: string) {
  const now = Date.now();
  const res = await query(
    `SELECT * FROM user_verification_codes 
     WHERE email = $1 AND type = $2 AND used = false AND expires_at > $3 
     ORDER BY created_at DESC LIMIT 1`,
    [email, type, now]
  );
  return res.rows[0] || null;
}

async function getUnusedCodeByValue(code: string, type: string) {
  const now = Date.now();
  const res = await query(
    `SELECT * FROM user_verification_codes 
     WHERE code = $1 AND type = $2 AND used = false AND expires_at > $3 
     ORDER BY created_at DESC LIMIT 1`,
    [code, type, now]
  );
  return res.rows[0] || null;
}

async function getLatestVerifiedCode(email: string, type: string) {
  const now = Date.now();
  // Allowed within 1 hour of verification
  const oneHourAgo = now - 60 * 60 * 1000;
  const res = await query(
    `SELECT * FROM user_verification_codes 
     WHERE email = $1 AND type = $2 AND verified_at IS NOT NULL AND verified_at > $3 
     ORDER BY verified_at DESC LIMIT 1`,
    [email, type, oneHourAgo]
  );
  return res.rows[0] || null;
}

async function markCodeUsed(id: string) {
  await query('UPDATE user_verification_codes SET used = true WHERE id = $1', [id]);
}

async function markCodeVerified(id: string) {
  const now = Date.now();
  await query('UPDATE user_verification_codes SET used = true, verified_at = $1 WHERE id = $2', [now, id]);
}

async function processDocumentUpload(imageUriOrBase64?: string, folder: string = 'shedrive/documents'): Promise<string | null> {
  if (!imageUriOrBase64 || typeof imageUriOrBase64 !== 'string') return null;
  const trimmed = imageUriOrBase64.trim();
  if (!trimmed) return null;
  
  // If it's already an http(s) URL (e.g. Cloudinary, CDN), retain as-is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  // If it is a base64 / data URI, upload to Cloudinary
  if (trimmed.startsWith('data:image/') || trimmed.length > 500) {
    try {
      const uploadRes = await uploadImage(trimmed, folder);
      return uploadRes.url;
    } catch (err: any) {
      console.warn(`[Registration Upload] Cloudinary warning for ${folder}:`, err?.message || err);
      return trimmed;
    }
  }
  
  return trimmed;
}

/**
 * POST /api/v1/auth/send-registration-otp
 * Body: { email: string, phone: string, role: string }
 * Description: Sends a 6-digit verification OTP to the user's email via Gmail SMTP prior to account registration.
 */
router.post('/send-registration-otp', otpRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, phone, role } = req.body;

    if (!email || !email.trim() || !phone || !phone.trim() || !role) {
      return res.status(400).json({ error: 'Email, phone number, and role are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    // Check if user already exists for this role
    const existingSameRole = await query(
      'SELECT id FROM users WHERE (phone = $1 OR email = $2) AND role = $3',
      [cleanPhone, cleanEmail, role]
    );

    if (existingSameRole.rows.length > 0) {
      return res.status(409).json({
        error: `An account with this phone number or email is already registered as a ${role === 'driver' ? 'Driver' : 'Passenger'}.`,
      });
    }

    // Check 60-second resend cooldown timer from database
    const existingEntry = await getLatestUnusedCode(cleanEmail, 'registration');
    if (existingEntry && Date.now() - parseInt(existingEntry.last_sent_at, 10) < 60000) {
      return res.status(200).json({
        success: true,
        message: 'Verification code was sent recently. Please check your email or wait 1 minute before resending.',
      });
    }

    // Generate secure 6-digit OTP code (10-minute expiry)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    await saveVerificationCode(cleanEmail, otp, 'registration', expiresAt);

    const emailHtml = buildRegistrationOtpEmailHtml(cleanEmail, otp);
    const sent = await sendEmail({
      to: cleanEmail,
      subject: 'Your SheDrive Email Verification Code',
      html: emailHtml,
      fromName: 'SheDrive Support',
    });

    if (!sent) {
      return res.status(500).json({
        error: 'Unable to send verification email. Please check your internet connection or try again in 30 seconds.',
      });
    }

    console.log(`[Registration OTP] Verification code generated and dispatched to ${cleanEmail}`);

    res.status(200).json({
      success: true,
      message: 'Verification code has been sent to your email address.',
    });
  } catch (error: any) {
    const errorStr = error?.message || String(error);
    console.error('[Registration OTP error]:', errorStr);
    res.status(500).json({
      error: 'Failed to generate verification code. Please try again.',
      ...(process.env.NODE_ENV !== 'production' ? { details: errorStr } : {})
    });
  }
});

/**
 * POST /api/v1/auth/verify-registration-otp
 * Body: { email: string, otp: string }
 * Description: Verifies the 6-digit registration OTP code entered by the user.
 */
router.post('/verify-registration-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !email.trim() || !otp || !otp.trim()) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    const storedEntry = await getLatestUnusedCode(cleanEmail, 'registration');

    if (!storedEntry) {
      return res.status(400).json({ error: 'No verification code request found for this email. Please request a new code.' });
    }

    if (Date.now() > parseInt(storedEntry.expires_at, 10)) {
      await markCodeUsed(storedEntry.id);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    const isMatch = storedEntry.code === cleanOtp;

    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid verification code. Please check the code sent to your email.' });
    }

    // Mark as verified with timestamp
    await markCodeVerified(storedEntry.id);

    res.status(200).json({
      success: true,
      message: 'Email address verified successfully!',
    });
  } catch (error: any) {
    console.error('Verify registration OTP error:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

/**
 * POST /api/v1/auth/register
 * Body: { phone, password, name, role, email, cnic, dateOfBirth?, vehicleInfo?, licenseFrontUrl?, licenseBackUrl?, selfieUrl? }
 * Description: Registers a new Passenger or Driver after email verification.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      phone,
      password,
      name,
      role,
      email,
      cnic,
      dateOfBirth,
      vehicleInfo,
      licenseFrontUrl,
      licenseBackUrl,
      selfieUrl,
      vehiclePhotoUrl,
      cnicFrontUrl,
      cnicBackUrl,
      acOption,
      acceptedTerms,
      city,
    } = req.body;

    if (!phone || !password || !name || !role || !email) {
      return res.status(400).json({ error: 'Phone number, password, name, role, and email are required' });
    }

    if (!city) {
      return res.status(400).json({ error: 'City is required' });
    }

    // CNIC is required for both passengers and drivers
    if (!cnic) {
      return res.status(400).json({ error: 'CNIC number is required' });
    }

    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Verify email was validated via OTP before allowing account creation
    const otpEntry = await getLatestVerifiedCode(cleanEmail, 'registration');
    if (!otpEntry) {
      return res.status(400).json({
        error: 'Please verify your email address with the OTP code before completing registration.',
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // CNIC validation (13 digits or formatted)
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$|^\d{13}$/;
    if (!cnicRegex.test(cnic.trim())) {
      return res.status(400).json({ error: 'Invalid CNIC number format' });
    }

    // CNIC gender validation: Check last digit (Even = Female, Odd = Male)
    const cnicDigits = cnic.trim().replace(/\D/g, '');
    const lastDigit = parseInt(cnicDigits.slice(-1), 10);
    if (lastDigit % 2 !== 0) {
      return res.status(400).json({
        error: 'This CNIC indicates male gender. SheDrive is strictly dedicated to female passengers and drivers.',
      });
    }

    // Driver age validation - must be at least 19 years old (dynamic date check)
    if (role === 'driver') {
      if (!dateOfBirth) {
        return res.status(400).json({ error: 'Date of birth is required for drivers' });
      }

      const dob = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }

      if (age < 19) {
        return res.status(400).json({
          error: 'You must be at least 19 years old to register as a SheDrive driver.',
        });
      }

      // Shared vehicle constraint: Maximum 4 drivers per vehicle
      if (vehicleInfo?.plate) {
        const cleanPlate = vehicleInfo.plate.trim().toUpperCase();
        if (cleanPlate) {
          const plateCountRes = await query(
            'SELECT COUNT(*) as count FROM drivers WHERE UPPER(vehicle_plate) = $1',
            [cleanPlate]
          );
          const currentDriversOnVehicle = parseInt(plateCountRes.rows[0].count, 10);
          if (currentDriversOnVehicle >= 4) {
            return res.status(409).json({
              error: 'This vehicle is already registered by the maximum limit of 4 drivers.',
            });
          }
        }
      }
    }

    // Duplicate validation: Same phone/email can be used for both passenger AND driver
    const existingSameRole = await query(
      'SELECT id FROM users WHERE (phone = $1 OR email = $2) AND role = $3',
      [cleanPhone, cleanEmail, role]
    );

    if (existingSameRole.rows.length > 0) {
      // Check if this is a rejected driver attempting to re-register within 24-hour cooldown
      if (role === 'driver') {
        const rejectedUser = await query(
          'SELECT id, verification_status, rejection_timestamp, rejection_reason FROM users WHERE (phone = $1 OR email = $2) AND role = $3 AND verification_status = $4',
          [cleanPhone, cleanEmail, role, 'rejected']
        );
        
        if (rejectedUser.rows.length > 0) {
          const user = rejectedUser.rows[0];
          const now = Date.now();
          const hoursSinceRejection = (now - user.rejection_timestamp) / (1000 * 60 * 60);
          
          if (hoursSinceRejection < 24) {
            const hoursRemaining = Math.ceil(24 - hoursSinceRejection);
            return res.status(403).json({ 
              error: `Your driver application was rejected. You can re-register after ${hoursRemaining} hours.`,
              rejectionReason: user.rejection_reason,
              canReRegisterAt: user.rejection_timestamp + (24 * 60 * 60 * 1000),
            });
          } else {
            // 24-hour cooldown has passed, allow re-registration by deleting old record
            await query('DELETE FROM drivers WHERE driver_id = $1', [user.id]);
            await query('DELETE FROM users WHERE id = $1', [user.id]);
          }
        } else {
          return res.status(409).json({ 
            error: `An account with this phone number or email already exists as a ${role}. You cannot register as ${role} twice.` 
          });
        }
      } else {
        return res.status(409).json({ 
          error: `An account with this phone number or email already exists as a ${role}. You cannot register as ${role} twice.` 
        });
      }
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const passHash = await hashPassword(password);
    const now = Date.now();

    // Process document uploads to Cloudinary if base64/data URLs are passed
    const finalCnicFrontUrl = await processDocumentUpload(cnicFrontUrl, 'shedrive/documents');
    const finalCnicBackUrl = await processDocumentUpload(cnicBackUrl, 'shedrive/documents');
    const finalLicenseFrontUrl = await processDocumentUpload(licenseFrontUrl, 'shedrive/documents');
    const finalLicenseBackUrl = await processDocumentUpload(licenseBackUrl, 'shedrive/documents');
    const finalSelfieUrl = await processDocumentUpload(selfieUrl, 'shedrive/avatars');
    const finalVehiclePhotoUrl = await processDocumentUpload(vehiclePhotoUrl, 'shedrive/vehicles');

    await withTransaction(async (dbClient) => {
      await dbClient.query(
        `INSERT INTO users (
          id, email, password_hash, name, phone, role, cnic, cnic_front_url, cnic_back_url, date_of_birth, city,
          is_verified, accepted_terms, accepted_privacy_policy, accepted_location_consent,
          accepted_document_consent, accepted_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          userId,
          cleanEmail,
          passHash,
          name.trim(),
          cleanPhone,
          role,
          cnic.trim(),
          finalCnicFrontUrl || null,
          finalCnicBackUrl || null,
          dateOfBirth || null,
          city?.trim() || 'Lahore',
          role === 'passenger' ? true : false,
          acceptedTerms !== false,
          true,
          true,
          true,
          now,
          now,
          now,
        ]
      );

      // If driver, insert vehicle and document record
      if (role === 'driver' && vehicleInfo) {
        await dbClient.query(
          `INSERT INTO drivers (
            driver_id, vehicle_category, vehicle_make, vehicle_model, vehicle_plate, vehicle_color,
            vehicle_year, license_front_url, license_back_url, selfie_url, vehicle_photo_url, ac_option,
            is_online, is_available, is_active, rating, total_rides, fee_terms_accepted, fee_terms_accepted_at, last_location_update
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
          [
            userId,
            vehicleInfo.category || 'mini',
            vehicleInfo.make || '',
            vehicleInfo.model || '',
            vehicleInfo.plate || '',
            vehicleInfo.color || '',
            vehicleInfo.year || '2022',
            finalLicenseFrontUrl || null,
            finalLicenseBackUrl || null,
            finalSelfieUrl || null,
            finalVehiclePhotoUrl || null,
            acOption || 'both',
            false,
            true,
            false,
            0.00,
            0,
            true,
            now,
            now,
          ]
        );
      }
    });


    // Invalidate consumed OTP code after successful account creation
    await query('DELETE FROM user_verification_codes WHERE email = $1 AND type = $2', [cleanEmail, 'registration']);

    // Also create/sync user in Supabase Auth (for password reset email support)
    if (cleanEmail) {
      try {
        const { data: supaData, error: createErr } = await supabase.auth.admin.createUser({
          email: cleanEmail,
          password: password,
          email_confirm: true,
        });

        if (createErr) {
          if (
            createErr.message?.toLowerCase().includes('already') ||
            createErr.message?.toLowerCase().includes('exists') ||
            createErr.status === 422
          ) {
            console.log(`[Supabase Auth] User ${cleanEmail} already exists in Supabase Auth. Syncing password...`);
            const { data: listData } = await supabase.auth.admin.listUsers();
            const existingSupaUser = listData?.users?.find(
              (u: any) => u.email?.toLowerCase() === cleanEmail
            );
            if (existingSupaUser) {
              await supabase.auth.admin.updateUserById(existingSupaUser.id, {
                password: password,
                email_confirm: true,
              });
              console.log(`[Supabase Auth] Successfully synced password for existing user ${cleanEmail}`);
            }
          } else {
            console.warn(`[Supabase Auth] Warning creating auth user for ${cleanEmail}:`, createErr.message);
          }
        } else if (supaData?.user) {
          console.log(`[Supabase Auth] Created new auth user for ${cleanEmail}`);
        }
      } catch (supaErr: any) {
        console.warn(`[Supabase Auth] Exception during auth user sync for ${cleanEmail}:`, supaErr?.message);
      }
    }

    const token = generateToken({ id: userId, email: cleanEmail, role });

    res.status(201).json({
      user: {
        id: userId,
        phone: cleanPhone,
        email: cleanEmail,
        name,
        role,
        cnic: cnic.trim(),
        dateOfBirth: dateOfBirth || null,
        isVerified: role === 'passenger',
      },
      token,
    });
  } catch (error) {
    console.error('Registration API error:', error);
    res.status(500).json({ error: 'Failed to complete registration' });
  }
});

/**
 * POST /api/v1/auth/login
 */
router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { identifier, email, phone, password, role } = req.body;
    const loginKey = (identifier || phone || email || '').trim();

    if (!loginKey || !password) {
      return res.status(400).json({ error: 'Mobile number/email and password are required' });
    }

    let queryStr = 'SELECT * FROM users WHERE (phone = $1 OR email = $1)';
    const queryParams: any[] = [loginKey];

    if (role) {
      queryStr += ' AND role = $2';
      queryParams.push(role);
    }

    const result = await query(queryStr, queryParams);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (user.is_blocked) {
      return res.status(403).json({
        error: 'Your account has been temporarily blocked because it violated our policies.',
      });
    }

    if (user.role === 'driver' && user.verification_status === 'rejected') {
      const now = Date.now();
      const hoursSinceRejection = user.rejection_timestamp ? (now - user.rejection_timestamp) / (1000 * 60 * 60) : Infinity;
      
      if (hoursSinceRejection < 24) {
        const hoursRemaining = Math.ceil(24 - hoursSinceRejection);
        return res.status(403).json({
          error: `Your driver application was rejected. You can re-register after ${hoursRemaining} hours.`,
          rejectionReason: user.rejection_reason,
          canReRegisterAt: user.rejection_timestamp + (24 * 60 * 60 * 1000),
          isRejected: true,
        });
      } else {
        return res.status(403).json({
          error: 'Your driver application was previously rejected. You can now re-register with updated documents.',
          rejectionReason: user.rejection_reason,
          canReRegisterNow: true,
          isRejected: true,
        });
      }
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    res.status(200).json({
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        role: user.role,
        cnic: user.cnic,
        isVerified: user.is_verified,
      },
      token,
    });
  } catch (error) {
    console.error('Login API error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * GET /api/v1/auth/reset-password-redirect
 * Query params: email, token, role
 *
 * Gmail blocks custom URI schemes (shedrive://) in email \<a\> href links.
 * This endpoint serves a lightweight HTML page that immediately triggers the
 * deep link via meta-refresh + JavaScript.  Gmail opens this standard http://
 * URL in Chrome → Chrome runs the JS → Android intercepts shedrive:// → app opens.
 */
router.get('/reset-password-redirect', (req: Request, res: Response) => {
  const { email, token, role } = req.query;

  const cleanEmail = typeof email === 'string' ? email.trim() : '';
  const cleanToken = typeof token === 'string' ? token.trim() : '';
  const cleanRole  = typeof role  === 'string' ? role.trim()  : '';

  const deepLink = `shedrive://reset-password?email=${encodeURIComponent(cleanEmail)}&token=${encodeURIComponent(cleanToken)}&role=${encodeURIComponent(cleanRole)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0;url=${deepLink}">
  <title>Opening SheDrive…</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f5f8;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}
    .card{background:#fff;border-radius:20px;padding:40px 28px;max-width:420px;width:100%;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.08)}
    .logo{font-size:48px;margin-bottom:12px}
    .title{font-size:22px;font-weight:800;color:#1a1a1a;margin-bottom:8px}
    .subtitle{font-size:15px;color:#666;line-height:1.5;margin-bottom:28px}
    .btn{display:inline-block;background:linear-gradient(135deg,#E91E63 0%,#C2185B 100%);color:#fff!important;font-size:16px;font-weight:700;text-decoration:none;padding:16px 32px;border-radius:14px;box-shadow:0 4px 14px rgba(233,30,99,.35);width:85%}
    .hint{margin-top:20px;font-size:13px;color:#999}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🚗</div>
    <div class="title">SheDrive Password Reset</div>
    <p class="subtitle">Opening the SheDrive app so you can set your new password…</p>
    <a href="${deepLink}" class="btn">Open SheDrive App</a>
    <p class="hint">If the app doesn't open automatically, tap the button above.</p>
  </div>
  <script>
    setTimeout(function(){ window.location.href = "${deepLink}"; }, 300);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/**
 * POST /api/v1/auth/forgot-password
 * Body: { email: string, role?: string }
 * Description: Sends custom HTML password reset email via Gmail SMTP (SheDrive Support <SheDrive.Support@gmail.com>).
 */

router.post('/forgot-password', passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    if (!role || (role !== 'passenger' && role !== 'driver')) {
      return res.status(400).json({ error: 'Account type (Passenger or Driver) is required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (cleanEmail.endsWith('@shedrive.local')) {
      return res.status(400).json({
        error: 'This account does not have an email address linked. Password reset is only available for accounts with a registered email address.',
      });
    }

    // Determine whether user exists specifically for the requested account role
    const userRes = await query('SELECT id, name, email, role FROM users WHERE email = $1 AND role = $2', [cleanEmail, role]);

    if (userRes.rows.length === 0) {
      // Return success to avoid email probing, but don't generate token
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists for the selected account type, a password reset link has been sent.',
      });
    }

    const user = userRes.rows[0];

    // Enforce role-scoped cooldown check from database
    const existing = await getLatestUnusedCode(cleanEmail, `password_reset:${role}`);
    const COOLDOWN_MS = 5 * 60 * 1000; // 5-minute cooldown

    if (existing && Date.now() - parseInt(existing.last_sent_at, 10) < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - (Date.now() - parseInt(existing.last_sent_at, 10));
      const remainingSec = Math.ceil(remainingMs / 1000);
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

      return res.status(429).json({
        error: `A password reset email was recently sent. Please wait ${timeStr} before requesting another link.`,
        cooldownSeconds: remainingSec,
      });
    }

    // Generate a completely new unique reset token (invalidates any previous link for this account)
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30 min expiry

    await saveVerificationCode(cleanEmail, token, `password_reset:${role}`, expiresAt);

    const hostHeader = req.headers.host || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const serverBaseUrl = process.env.SERVER_BASE_URL || `${protocol}://${hostHeader}`;

    const directDeepLink = `shedrive://reset-password?email=${encodeURIComponent(cleanEmail)}&token=${token}&role=${user.role}`;
    const webRedirectLink = `${serverBaseUrl}/api/v1/auth/reset-password-redirect?email=${encodeURIComponent(cleanEmail)}&token=${token}&role=${user.role}`;

    const emailHtml = buildPasswordResetEmailHtml(user.name || 'SheDrive Member', cleanEmail, webRedirectLink, directDeepLink);

    await sendEmail({
      to: cleanEmail,
      subject: `Reset Your SheDrive ${user.role === 'driver' ? 'Driver' : 'Passenger'} Password`,
      html: emailHtml,
      fromName: 'SheDrive Support',
    });

    console.log(`[Gmail SMTP] Password reset email sent successfully to ${cleanEmail} (${user.role})`);

    res.status(200).json({
      success: true,
      message: 'Password reset link has been sent to your email address.',
      cooldownSeconds: 300,
    });
  } catch (error: any) {
    console.error('[Gmail SMTP] Forgot password error:', error.message || error);
    res.status(500).json({ error: 'Failed to send password reset email. Please try again later.' });
  }
});

/**
 * POST /api/v1/auth/update-password-from-reset
 * Body: { email: string, newPassword: string, token?: string, role?: string }
 * Description: Updates the password in PostgreSQL for the specified account type and syncs with Supabase Auth.
 */
router.post('/update-password-from-reset', async (req: Request, res: Response) => {
  try {
    const { email, newPassword, token, role } = req.body;

    if (!email || !newPassword || !token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'Email, new password, and reset security token are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    // Query user by BOTH email and role to ensure correct account type is updated
    let userRes;
    if (role) {
      userRes = await query('SELECT id, phone, email, name, role, cnic, is_verified, is_blocked FROM users WHERE email = $1 AND role = $2', [cleanEmail, role]);
    } else {
      userRes = await query('SELECT id, phone, email, name, role, cnic, is_verified, is_blocked FROM users WHERE email = $1', [cleanEmail]);
    }

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found for the specified role' });
    }

    const user = userRes.rows[0];

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Your account has been temporarily blocked.' });
    }

    // Security token check from database — strictly require matching token and email
    const stored = await getUnusedCodeByValue(cleanToken, `password_reset:${user.role}`);

    if (!stored || stored.email.toLowerCase() !== cleanEmail) {
      return res.status(400).json({
        error: 'This password reset link is invalid or has expired. Please request a new password reset.',
      });
    }

    if (Date.now() > parseInt(stored.expires_at, 10)) {
      await markCodeUsed(stored.id);
      return res.status(400).json({
        error: 'This password reset link has expired. Please use the most recently sent link or request a new one.',
      });
    }

    const passHash = await hashPassword(newPassword);
    // Update password and mark token as used
    await markCodeUsed(stored.id);
    // Update ONLY the exact user matching ID (guarantees correct account type is updated)
    await query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [
      passHash,
      Date.now(),
      user.id,
    ]);

    try {
      const { data: sbUsers } = await supabase.auth.admin.listUsers();
      const sbUser = sbUsers?.users?.find((u: any) => u.email === cleanEmail);
      if (sbUser) {
        await supabase.auth.admin.updateUserById(sbUser.id, { password: newPassword });
      }
    } catch (sbErr: any) {
      console.warn('[Supabase Auth] Password sync warning:', sbErr.message || sbErr);
    }

    // Invalidate consumed reset token immediately (already marked used)

    const authToken = generateToken({ id: user.id, email: user.email, role: user.role });

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        role: user.role,
        cnic: user.cnic,
        isVerified: user.is_verified,
      },
      token: authToken,
    });
  } catch (error: any) {
    console.error('Update password from reset error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

/**
 * POST /api/v1/auth/forgot-password/send-otp
 * Body: { email: string, role?: string }
 * Description: Dispatches a 6-digit numeric OTP to email for password reset via Gmail REST API.
 */
router.post('/forgot-password/send-otp', passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const userRole = role === 'driver' ? 'driver' : 'passenger';

    // Verify user exists for the requested role
    const userRes = await query('SELECT id, name, email, role FROM users WHERE email = $1 AND role = $2', [cleanEmail, userRole]);
    if (userRes.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a verification code has been dispatched.',
      });
    }

    const user = userRes.rows[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10-minute expiry

    await saveVerificationCode(cleanEmail, otp, `password_reset_otp:${user.role}`, expiresAt);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 12px;">
        <h2 style="color: #E91E63; text-align: center;">SheDrive Password Reset</h2>
        <p>Hello <strong>${user.name || 'SheDrive Member'}</strong>,</p>
        <p>Your 6-digit verification code to reset your SheDrive ${user.role} password is:</p>
        <div style="background: #FCE4EC; padding: 18px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #C2185B; border-radius: 8px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="font-size: 13px; color: #666;">This code will expire in 10 minutes. If you did not request this password reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999; text-align: center;">SheDrive Operations Pvt. Ltd. — Lahore, Pakistan</p>
      </div>
    `;

    const sent = await sendEmail({
      to: cleanEmail,
      subject: `Your SheDrive Password Reset Code: ${otp}`,
      html: emailHtml,
      fromName: 'SheDrive Support',
    });

    if (!sent) {
      return res.status(500).json({
        error: 'Unable to send password reset code. Please check your internet connection or try again in 30 seconds.',
      });
    }

    console.log(`[Gmail REST API] Password reset OTP sent to ${cleanEmail}`);

    res.status(200).json({
      success: true,
      message: 'Password reset code has been sent to your email address.',
      cooldownSeconds: 60,
    });
  } catch (error: any) {
    console.error('Send reset OTP error:', error.message || error);
    res.status(500).json({ error: 'Failed to send password reset code' });
  }
});

/**
 * POST /api/v1/auth/forgot-password/verify-otp
 * Body: { email: string, otp: string, role?: string }
 * Description: Verifies the 6-digit password reset OTP and issues a reset token.
 */
router.post('/forgot-password/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp, role } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();
    const userRole = role === 'driver' ? 'driver' : 'passenger';

    const stored = await getUnusedCodeByValue(cleanOtp, `password_reset_otp:${userRole}`);
    if (!stored || stored.email.toLowerCase() !== cleanEmail) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    if (Date.now() > parseInt(stored.expires_at, 10)) {
      await markCodeUsed(stored.id);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    await markCodeVerified(stored.id);

    // Generate a reset token valid for 15 minutes
    const resetToken = crypto.randomBytes(24).toString('hex');
    const tokenExpiry = Date.now() + 15 * 60 * 1000;
    await saveVerificationCode(cleanEmail, resetToken, `password_reset:${userRole}`, tokenExpiry);

    res.status(200).json({
      success: true,
      message: 'Code verified successfully',
      resetToken,
    });
  } catch (error: any) {
    console.error('Verify reset OTP error:', error.message || error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

/**
 * POST /api/v1/auth/reset-password
 * Body: { email: string, newPassword: string, token?: string, otp?: string, role?: string }
 * Description: Universal reset-password endpoint supporting both token-based and OTP-based resets.
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, newPassword, token, otp, role } = req.body;

    if (!email || !newPassword || (!token && !otp)) {
      return res.status(400).json({ error: 'Email, new password, and reset token or verification code are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const userRole = role === 'driver' ? 'driver' : 'passenger';

    // Verify user exists
    const userRes = await query('SELECT id, phone, email, name, role, cnic, is_verified, is_blocked FROM users WHERE email = $1 AND role = $2', [cleanEmail, userRole]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found for the specified role' });
    }

    const user = userRes.rows[0];
    if (user.is_blocked) {
      return res.status(403).json({ error: 'Your account has been temporarily blocked.' });
    }

    // Check reset token or OTP
    let validRecord = null;
    if (token) {
      validRecord = await getUnusedCodeByValue(token.trim(), `password_reset:${user.role}`);
    } else if (otp) {
      validRecord = await getUnusedCodeByValue(otp.trim(), `password_reset_otp:${user.role}`);
    }

    if (!validRecord || validRecord.email.toLowerCase() !== cleanEmail) {
      return res.status(400).json({ error: 'Invalid or expired password reset credentials. Please request a new reset link/code.' });
    }

    if (Date.now() > parseInt(validRecord.expires_at, 10)) {
      await markCodeUsed(validRecord.id);
      return res.status(400).json({ error: 'Password reset credentials have expired. Please request a new one.' });
    }

    const passHash = await hashPassword(newPassword);
    await markCodeUsed(validRecord.id);
    await query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [
      passHash,
      Date.now(),
      user.id,
    ]);

    try {
      const { data: sbUsers } = await supabase.auth.admin.listUsers();
      const sbUser = sbUsers?.users?.find((u: any) => u.email === cleanEmail);
      if (sbUser) {
        await supabase.auth.admin.updateUserById(sbUser.id, { password: newPassword });
      }
    } catch (sbErr: any) {
      console.warn('[Supabase Auth] Password sync warning:', sbErr?.message || sbErr);
    }

    const authToken = generateToken({ id: user.id, email: user.email, role: user.role });

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        role: user.role,
        cnic: user.cnic,
        isVerified: user.is_verified,
      },
      token: authToken,
    });
  } catch (error: any) {
    console.error('Reset password error:', error.message || error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});


/**
 * POST /api/v1/auth/change-password
 * Header: Authorization: Bearer <token>
 * Body: { currentPassword, newPassword }
 */
router.post('/change-password', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const userRes = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await comparePassword(currentPassword, userRes.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [
      passHash,
      Date.now(),
      userId,
    ]);

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

/**
 * DELETE /api/v1/auth/delete-account
 * Header: Authorization: Bearer <token>
 */
router.delete('/delete-account', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const now = Date.now();

    // Retrieve user info and media assets for audit trail and Cloudinary cleanup before deletion
    const userRes = await query(
      'SELECT id, name, email, role, cnic_front_url, cnic_back_url FROM users WHERE id = $1',
      [userId]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const user = userRes.rows[0];

    // Collect all document URLs to purge from Cloudinary
    const docUrls: string[] = [];
    if (user.cnic_front_url) docUrls.push(user.cnic_front_url);
    if (user.cnic_back_url) docUrls.push(user.cnic_back_url);

    // If driver, retrieve driver-specific document uploads and set offline
    if (user.role === 'driver') {
      const driverRes = await query(
        'SELECT vehicle_photo_url, license_url, license_front_url, license_back_url, selfie_url, cnic_front_url, cnic_back_url FROM drivers WHERE driver_id = $1',
        [userId]
      );
      if (driverRes.rows.length > 0) {
        const d = driverRes.rows[0];
        if (d.vehicle_photo_url) docUrls.push(d.vehicle_photo_url);
        if (d.license_url) docUrls.push(d.license_url);
        if (d.license_front_url) docUrls.push(d.license_front_url);
        if (d.license_back_url) docUrls.push(d.license_back_url);
        if (d.selfie_url) docUrls.push(d.selfie_url);
        if (d.cnic_front_url) docUrls.push(d.cnic_front_url);
        if (d.cnic_back_url) docUrls.push(d.cnic_back_url);
      }
      await query('UPDATE drivers SET is_online = false, is_available = false WHERE driver_id = $1', [userId]);
    }

    // Purge binary assets from Cloudinary
    for (const url of docUrls) {
      const publicId = extractCloudinaryPublicId(url);
      if (publicId) {
        try {
          await deleteImage(publicId);
        } catch (cErr) {
          console.warn('[Cloudinary Cleanup Notice] Could not delete image:', publicId);
        }
      }
    }

    // Write ACCOUNT_DELETED audit log BEFORE deletion (ON DELETE CASCADE would remove it if user_id is FK)
    const auditId = `aud_${now}_${Math.random().toString(36).substring(2, 6)}`;
    await query(
      `INSERT INTO audit_logs (id, user_id, action, details, timestamp)
       VALUES ($1, $2, 'ACCOUNT_DELETED', $3, $4)`,
      [auditId, userId, JSON.stringify({ name: user.name, email: user.email, role: user.role }), now]
    );

    await query('DELETE FROM users WHERE id = $1', [userId]);
    res.status(200).json({ success: true, message: 'Account and associated media deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
