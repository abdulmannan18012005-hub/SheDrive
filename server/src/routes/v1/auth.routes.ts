import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../../config/db';
import { generateToken, hashPassword, comparePassword, authenticateToken } from '../../middleware/auth';
import { supabase } from '../../config/supabase';
import { sendEmail } from '../../services/smtp';
import { buildPasswordResetEmailHtml, buildRegistrationOtpEmailHtml } from '../../utils/emailTemplates';

const router = Router();

// In-memory store for registration OTPs
interface RegistrationOtpEntry {
  otp: string;
  expiresAt: number;
  lastSentAt: number;
  verified: boolean;
}
const registrationOtpStore = new Map<string, RegistrationOtpEntry>();

// In-memory store for password reset tokens and email throttling
interface ResetTokenEntry {
  token: string;
  expiresAt: number;
  lastSentAt: number;
}
const resetTokensStore = new Map<string, ResetTokenEntry>();

/**
 * POST /api/v1/auth/send-registration-otp
 * Body: { email: string, phone: string, role: string }
 * Description: Sends a 6-digit verification OTP to the user's email via Gmail SMTP prior to account registration.
 */
router.post('/send-registration-otp', async (req: Request, res: Response) => {
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

    // Check 60-second resend cooldown timer
    const existingEntry = registrationOtpStore.get(cleanEmail);
    if (existingEntry && Date.now() - existingEntry.lastSentAt < 60000) {
      return res.status(200).json({
        success: true,
        message: 'Verification code was sent recently. Please check your email or wait 1 minute before resending.',
      });
    }

    // Generate secure 6-digit OTP code (10-minute expiry)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    registrationOtpStore.set(cleanEmail, {
      otp,
      expiresAt,
      lastSentAt: Date.now(),
      verified: false,
    });

    // Build professional HTML email and send via Gmail SMTP
    const emailHtml = buildRegistrationOtpEmailHtml(cleanEmail, otp);
    await sendEmail({
      to: cleanEmail,
      subject: 'Your SheDrive Email Verification Code',
      html: emailHtml,
      fromName: 'SheDrive Support',
    });

    console.log(`[Gmail SMTP] Registration OTP sent to ${cleanEmail}`);

    res.status(200).json({
      success: true,
      message: 'Verification code has been sent to your email address.',
    });
  } catch (error: any) {
    console.error('[Gmail SMTP] Registration OTP error:', error.message || error);
    const detail = error.message || 'Unknown SMTP error';
    res.status(500).json({
      error: 'Failed to send verification code. Please check your email address and try again.',
      details: detail
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

    const storedEntry = registrationOtpStore.get(cleanEmail);

    if (!storedEntry) {
      return res.status(400).json({ error: 'No verification code request found for this email. Please request a new code.' });
    }

    if (Date.now() > storedEntry.expiresAt) {
      registrationOtpStore.delete(cleanEmail);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    if (storedEntry.otp !== cleanOtp) {
      return res.status(400).json({ error: 'Invalid verification code. Please check the code sent to your email.' });
    }

    // Mark as verified
    storedEntry.verified = true;
    registrationOtpStore.set(cleanEmail, storedEntry);

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
    const otpEntry = registrationOtpStore.get(cleanEmail);
    if (!otpEntry || !otpEntry.verified) {
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

    await query(
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
        cnicFrontUrl || null,
        cnicBackUrl || null,
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
      await query(
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
          licenseFrontUrl || null,
          licenseBackUrl || null,
          selfieUrl || null,
          vehiclePhotoUrl || null,
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


    // Invalidate consumed OTP code after successful account creation
    registrationOtpStore.delete(cleanEmail);

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
router.post('/login', async (req: Request, res: Response) => {
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

router.post('/forgot-password', async (req: Request, res: Response) => {
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

    // Enforce role-scoped store key: cleanEmail:role
    const storeKey = `${cleanEmail}:${role}`;
    const existing = resetTokensStore.get(storeKey);
    const COOLDOWN_MS = 5 * 60 * 1000; // 5-minute cooldown

    if (existing && Date.now() - existing.lastSentAt < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - (Date.now() - existing.lastSentAt);
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

    resetTokensStore.set(storeKey, {
      token,
      expiresAt,
      lastSentAt: Date.now(),
    });

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

    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();

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

    // Security token check
    const storeKey = `${cleanEmail}:${user.role}`;
    const stored = resetTokensStore.get(storeKey);

    if (!stored || (token && stored.token !== token)) {
      return res.status(400).json({
        error: 'This password reset link has expired. Please use the most recently sent link or request a new one.',
      });
    }

    if (Date.now() > stored.expiresAt) {
      resetTokensStore.delete(storeKey);
      return res.status(400).json({
        error: 'This password reset link has expired. Please use the most recently sent link or request a new one.',
      });
    }

    const passHash = await hashPassword(newPassword);
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

    // Invalidate consumed reset token immediately
    resetTokensStore.delete(storeKey);

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
    await query('DELETE FROM users WHERE id = $1', [userId]);
    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
