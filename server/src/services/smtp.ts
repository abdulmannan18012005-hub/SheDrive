import nodemailer from 'nodemailer';
import { google } from 'googleapis';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}

const gmailUser = (process.env.GMAIL_USER || 'SheDrive.Support@gmail.com').trim();
const gmailPass = (process.env.GMAIL_APP_PASSWORD || 'pofs asgp bruk yomi').replace(/\s+/g, '');

/**
 * Standard Gmail SMTP Transporter (Fallback for local dev or when Render is upgraded)
 */
const smtpTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: gmailUser, pass: gmailPass },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

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
  const utf8Subject = `=?utf-8?B?${Buffer.from(options.subject, 'utf-8').toString('base64')}?=`;
  const messageParts = [
    `From: "${senderName}" <${gmailUser}>`,
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
 * 1. Gmail REST API (HTTPS Port 443 — when OAuth2 credentials exist on Render)
 * 2. Gmail SMTP via Nodemailer (Port 465 SSL — fallback for local dev / paid server)
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const senderName = options.fromName || 'SheDrive Support';
  const clientId = (process.env.GMAIL_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GMAIL_CLIENT_SECRET || '').trim();
  const refreshToken = (process.env.GMAIL_REFRESH_TOKEN || '').trim();

  // ── Primary: Gmail REST API over HTTPS (Bypasses all cloud port blocks) ──
  if (clientId && clientSecret && refreshToken) {
    try {
      const gmail = getGmailService(clientId, clientSecret, refreshToken);
      const raw = createRawEmail(options, senderName);

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });

      console.log(`[Gmail API (HTTPS)] Email delivered: ${res.data.id} to ${options.to}`);
      return true;
    } catch (apiErr: any) {
      console.error('[Gmail API (HTTPS)] Error:', apiErr.message || apiErr);
      throw new Error(`Gmail API Delivery Failed: ${apiErr.message || apiErr}`);
    }
  }

  // ── Fallback: Gmail SMTP via Nodemailer (Free, unlimited for local / paid host) ──
  try {
    const info = await smtpTransporter.sendMail({
      from: `"${senderName}" <${gmailUser}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(`[Gmail SMTP (SSL)] Email sent: ${info.messageId} to ${options.to}`);
    return true;
  } catch (smtpErr: any) {
    console.error('[Gmail SMTP] sendMail error:', smtpErr.message || smtpErr);
    throw smtpErr;
  }
}
