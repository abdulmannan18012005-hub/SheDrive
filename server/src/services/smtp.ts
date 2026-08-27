import nodemailer from 'nodemailer';
import { google } from 'googleapis';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}

const GMAIL_DEFAULT_USER = 'SheDrive.Support@gmail.com';
const GMAIL_DEFAULT_PASS = 'pofs asgp bruk yomi';

function getCredentials() {
  const user = (process.env.GMAIL_USER || GMAIL_DEFAULT_USER).trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || GMAIL_DEFAULT_PASS).replace(/\s+/g, '');
  return { user, pass };
}

/**
 * Creates a nodemailer transporter for a specific port and security configuration
 */
function createSmtpTransporter(port: number, secure: boolean) {
  const { user, pass } = getCredentials();
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    tls: {
      rejectUnauthorized: false,
    },
  });
}

import { supabase } from '../config/supabase';

// Cache OAuth2 Client instance so token exchanges are persistent and instant (no re-handshake overhead)
let cachedOAuth2Client: any = null;
let cachedGmailService: any = null;

function getGmailService(clientId: string, clientSecret: string, refreshToken: string) {
  if (!cachedGmailService) {
    cachedOAuth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground'
    );
    cachedOAuth2Client.setCredentials({ refresh_token: refreshToken });
    cachedGmailService = google.gmail({ version: 'v1', auth: cachedOAuth2Client });
  }
  return cachedGmailService;
}

/**
 * Helper to encode an email payload into standard RFC 2822 base64url for the Gmail API
 */
function createRawEmail(options: SendEmailOptions, senderName: string): string {
  const { user } = getCredentials();
  const utf8Subject = `=?utf-8?B?${Buffer.from(options.subject, 'utf-8').toString('base64')}?=`;
  const messageParts = [
    `From: "${senderName}" <${user}>`,
    `To: <${options.to}>`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    options.html,
  ];
  const message = messageParts.join('\r\n');
  return Buffer.from(message, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Send email via best available transport:
 * 1. Supabase Cloud Auth OTP Dispatch (HTTPS Port 443 — guaranteed delivery from Render)
 * 2. Gmail REST API (HTTPS Port 443 — when OAuth2 credentials exist on Render)
 * 3. Gmail SMTP via Nodemailer Port 465 (SSL)
 * 4. Gmail SMTP via Nodemailer Port 587 (STARTTLS)
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const senderName = options.fromName || 'SheDrive Support';
  const { user } = getCredentials();
  let delivered = false;

  // ── Primary 1: Supabase Cloud Auth OTP Dispatch (HTTPS Port 443 — Never blocked by cloud firewalls) ──
  try {
    if (supabase && typeof supabase.auth?.signInWithOtp === 'function') {
      const sbRes = await supabase.auth.signInWithOtp({ email: options.to });
      if (!sbRes.error) {
        console.log(`[Supabase Auth (HTTPS Port 443)] Email OTP dispatched to ${options.to}`);
        delivered = true;
      }
    }
  } catch (sbErr: any) {
    console.warn('[Supabase Auth Email Warning]:', sbErr?.message || sbErr);
  }

  const clientId = (process.env.GMAIL_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GMAIL_CLIENT_SECRET || '').trim();
  const refreshToken = (process.env.GMAIL_REFRESH_TOKEN || '').trim();

  // ── Primary 2: Gmail REST API over HTTPS (Bypasses all cloud port blocks) ──
  if (clientId && clientSecret && refreshToken) {
    try {
      const gmail = getGmailService(clientId, clientSecret, refreshToken);
      const raw = createRawEmail(options, senderName);

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });

      console.log(`[Gmail API (HTTPS)] Email delivered: ${res.data.id} to ${options.to}`);
      delivered = true;
    } catch (apiErr: any) {
      console.warn('[Gmail API (HTTPS)] Warning (falling back to SMTP):', apiErr.message || apiErr);
    }
  }

  // ── Secondary: Gmail SMTP via Port 465 (SSL) ──
  try {
    const transporter465 = createSmtpTransporter(465, true);
    const info = await transporter465.sendMail({
      from: `"${senderName}" <${user}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(`[Gmail SMTP (Port 465 SSL)] Email sent: ${info.messageId} to ${options.to}`);
    return true;
  } catch (smtpErr465: any) {
    console.warn('[Gmail SMTP Port 465] Attempt failed, trying Port 587 STARTTLS...', smtpErr465.message || smtpErr465);
  }

  // ── Tertiary: Gmail SMTP via Port 587 (STARTTLS) ──
  try {
    const transporter587 = createSmtpTransporter(587, false);
    const info = await transporter587.sendMail({
      from: `"${senderName}" <${user}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(`[Gmail SMTP (Port 587 STARTTLS)] Email sent: ${info.messageId} to ${options.to}`);
    return true;
  } catch (smtpErr587: any) {
    console.warn('[Gmail SMTP Port 587] sendMail warning (outbound cloud port blocked):', smtpErr587.message || smtpErr587);
  }

  // ── Quaternary: HTTPS API (Resend / Brevo) if API key is provided ──
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${senderName} <onboarding@resend.dev>`,
          to: [options.to],
          subject: options.subject,
          html: options.html,
        }),
      });
      if (res.ok) {
        console.log(`[Resend HTTPS API] Email delivered to ${options.to}`);
        return true;
      }
    } catch (resendErr: any) {
      console.warn('[Resend API Error]:', resendErr.message || resendErr);
    }
  }

  console.warn(`[Email Notification] Email delivery to ${options.to} completed with fallback. Code stored in database.`);
  return false;
}
