/**
 * Generates a professional, responsive HTML email template for SheDrive Password Reset.
 *
 * @param name        - User's display name
 * @param email       - User's email address
 * @param resetLink   - Primary button href (should be an http:// redirect URL for Gmail compatibility)
 * @param directDeepLink - Optional deep link (shedrive://...) shown in the fallback text box
 */
export function buildPasswordResetEmailHtml(
  name: string,
  email: string,
  resetLink: string,
  directDeepLink?: string
): string {
  const userName = name || 'SheDrive Member';
  const supportEmail = 'SheDrive.Support@gmail.com';
  const fallbackLink = directDeepLink || resetLink;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your SheDrive Password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f5f8;
      font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #333333;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f4f5f8;
      padding-bottom: 40px;
    }
    .main {
      background-color: #ffffff;
      margin: 0 auto;
      width: 100%;
      max-width: 600px;
      border-spacing: 0;
      font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
    }
    .header {
      background: linear-gradient(135deg, #E91E63 0%, #9C27B0 100%);
      padding: 36px 30px;
      text-align: center;
    }
    .header-title {
      color: #ffffff;
      font-size: 28px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .header-subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      margin-top: 6px;
      font-weight: 500;
    }
    .content {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 16px;
    }
    .text-body {
      font-size: 15px;
      line-height: 1.6;
      color: #555555;
      margin-bottom: 24px;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn-reset {
      display: inline-block;
      background: linear-gradient(135deg, #E91E63 0%, #C2185B 100%);
      color: #ffffff !important;
      font-size: 16px;
      font-weight: 700;
      text-decoration: none;
      padding: 16px 36px;
      border-radius: 12px;
      box-shadow: 0 4px 14px rgba(233, 30, 99, 0.35);
      transition: all 0.2s ease;
    }
    .link-box {
      background-color: #f8f9fa;
      border: 1px dashed #e0e0e0;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 24px;
      word-break: break-all;
      font-size: 13px;
      color: #666666;
    }
    .link-text {
      color: #E91E63;
      font-weight: 600;
      text-decoration: none;
    }
    .info-card {
      background-color: #fff0f5;
      border-left: 4px solid #E91E63;
      padding: 16px 20px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 28px;
    }
    .info-card p {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: #880e4f;
    }
    .footer {
      background-color: #1a1c23;
      color: #a0a5ba;
      padding: 30px 24px;
      text-align: center;
      font-size: 13px;
      line-height: 1.6;
    }
    .social-links {
      margin-bottom: 16px;
    }
    .social-links a {
      color: #ffffff;
      text-decoration: none;
      margin: 0 10px;
      font-weight: 600;
      font-size: 13px;
    }
    .footer-copy {
      color: #70758a;
      font-size: 12px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <br>
    <table class="main" align="center" width="100%">
      <tr>
        <td class="header">
          <h1 class="header-title">🚗 SheDrive</h1>
          <div class="header-subtitle">Women's Safe Ride-Hailing Platform</div>
        </td>
      </tr>
      <tr>
        <td class="content">
          <div class="greeting">Hello, ${userName}!</div>
          <p class="text-body">
            We received a request to reset your SheDrive account password for <strong>${email}</strong>. Tap the button below to open the SheDrive app and choose your new password:
          </p>
          <div class="btn-container">
            <a href="${resetLink}" class="btn-reset" target="_blank">Reset Your Password</a>
          </div>

          <div class="link-box">
            <strong>If tapping the button doesn't open the app directly:</strong><br>
            Copy and paste this link into your phone browser:<br>
            <a href="${fallbackLink}" class="link-text">${fallbackLink}</a>
          </div>

          <div class="info-card">
            <p>
              🔒 <strong>Security & Expiration Notice:</strong><br>
              This link is valid for <strong>30 minutes</strong>. If you did not request this password reset, please ignore this email or contact support immediately. Your account remains completely secure.
            </p>
          </div>

          <p class="text-body" style="margin-bottom: 0;">
            Need help? Contact us anytime at <a href="mailto:${supportEmail}" style="color: #E91E63; font-weight: 600;">${supportEmail}</a>.
          </p>
        </td>
      </tr>
      <tr>
        <td class="footer">
          <div class="social-links">
            <a href="https://facebook.com/shedrive.pk" target="_blank">Facebook</a> &bull;
            <a href="https://instagram.com/shedrive.pk" target="_blank">Instagram</a> &bull;
            <a href="mailto:${supportEmail}">Support</a>
          </div>
          <div>SheDrive Pakistan — Empowering Women's Mobility & Safety</div>
          <div class="footer-copy">
            &copy; 2026 SheDrive Pakistan. All rights reserved.
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `;
}

/**
 * Generates a professional, responsive HTML email template for SheDrive Registration OTP Verification
 */
export function buildRegistrationOtpEmailHtml(email: string, otp: string): string {
  const supportEmail = 'SheDrive.Support@gmail.com';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your SheDrive Email Verification Code</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f5f8;
      font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #333333;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f4f5f8;
      padding-bottom: 40px;
    }
    .main {
      background-color: #ffffff;
      margin: 0 auto;
      width: 100%;
      max-width: 600px;
      border-spacing: 0;
      font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
    }
    .header {
      background: linear-gradient(135deg, #E91E63 0%, #9C27B0 100%);
      padding: 36px 30px;
      text-align: center;
    }
    .header-title {
      color: #ffffff;
      font-size: 28px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .header-subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      margin-top: 6px;
      font-weight: 500;
    }
    .content {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 16px;
    }
    .text-body {
      font-size: 15px;
      line-height: 1.6;
      color: #555555;
      margin-bottom: 24px;
    }
    .otp-container {
      text-align: center;
      margin: 28px 0;
    }
    .otp-code {
      display: inline-block;
      background: #fff0f5;
      color: #E91E63;
      font-size: 36px;
      font-weight: 900;
      letter-spacing: 8px;
      padding: 16px 32px;
      border-radius: 16px;
      border: 2px dashed #E91E63;
      font-family: 'Courier New', Courier, monospace;
    }
    .info-card {
      background-color: #f8f9fa;
      border-left: 4px solid #E91E63;
      padding: 16px 20px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 28px;
    }
    .info-card p {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: #555555;
    }
    .footer {
      background-color: #1a1c23;
      color: #a0a5ba;
      padding: 30px 24px;
      text-align: center;
      font-size: 13px;
      line-height: 1.6;
    }
    .social-links {
      margin-bottom: 16px;
    }
    .social-links a {
      color: #ffffff;
      text-decoration: none;
      margin: 0 10px;
      font-weight: 600;
      font-size: 13px;
    }
    .footer-copy {
      color: #70758a;
      font-size: 12px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <br>
    <table class="main" align="center" width="100%">
      <tr>
        <td class="header">
          <h1 class="header-title">🚗 SheDrive</h1>
          <div class="header-subtitle">Women's Safe Ride-Hailing Platform</div>
        </td>
      </tr>
      <tr>
        <td class="content">
          <div class="greeting">Welcome to SheDrive!</div>
          <p class="text-body">
            Thank you for registering with SheDrive. Use the 6-digit verification code below to confirm your email address (<strong>${email}</strong>) and complete your registration:
          </p>

          <div class="otp-container">
            <div class="otp-code">${otp}</div>
          </div>

          <div class="info-card">
            <p>
              🔒 <strong>Security Note:</strong><br>
              This verification code is valid for <strong>10 minutes</strong>. Do not share this code with anyone. If you did not attempt to register on SheDrive, please ignore this email.
            </p>
          </div>

          <p class="text-body" style="margin-bottom: 0;">
            Need help? Contact us anytime at <a href="mailto:${supportEmail}" style="color: #E91E63; font-weight: 600;">${supportEmail}</a>.
          </p>
        </td>
      </tr>
      <tr>
        <td class="footer">
          <div class="social-links">
            <a href="https://facebook.com/shedrive.pk" target="_blank">Facebook</a> &bull;
            <a href="https://instagram.com/shedrive.pk" target="_blank">Instagram</a> &bull;
            <a href="mailto:${supportEmail}">Support</a>
          </div>
          <div>SheDrive Pakistan — Empowering Women's Mobility & Safety</div>
          <div class="footer-copy">
            &copy; 2026 SheDrive Pakistan. All rights reserved.
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `;
}
