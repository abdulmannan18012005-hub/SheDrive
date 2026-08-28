import { google } from 'googleapis';
import nodemailer from 'nodemailer';

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

// ── Persistent Cached OAuth2 Client & Gmail Service (HTTPS Port 443) ──
let cachedOAuth2Client: any = null;
let cachedGmailService: any = null;

export function getGmailService(clientId?: string, clientSecret?: string, refreshToken?: string) {
  const cId = (clientId || process.env.GMAIL_CLIENT_ID || '').trim();
  const cSecret = (clientSecret || process.env.GMAIL_CLIENT_SECRET || '').trim();
  const rToken = (refreshToken || process.env.GMAIL_REFRESH_TOKEN || '').trim();

  if (!cachedGmailService && cId && cSecret && rToken) {
    cachedOAuth2Client = new google.auth.OAuth2(
      cId,
      cSecret,
      'https://developers.google.com/oauthplayground'
    );
    cachedOAuth2Client.setCredentials({ refresh_token: rToken });
    cachedGmailService = google.gmail({ version: 'v1', auth: cachedOAuth2Client });
  }
  return cachedGmailService;
}

/**
 * Creates RFC 2822 standard email payload in base64url format for Gmail REST API
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
  return Buffer.from(messageParts.join('\r\n'), 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Dedicated High-Speed Email Dispatcher:
 * 1. Gmail REST API (HTTPS Port 443 via Google Cloud OAuth2) — Primary transport, instant (<1s latency), firewall-immune.
 * 2. Strict 3000ms (3-second) Timeout Guarantee — Guarantees the auth endpoints respond swiftly without hanging.
 * 3. Zero Magic Links — Supabase Auth email dispatch removed completely.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const senderName = options.fromName || 'SheDrive Support';
  const startTime = Date.now();

  const clientId = (process.env.GMAIL_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GMAIL_CLIENT_SECRET || '').trim();
  const refreshToken = (process.env.GMAIL_REFRESH_TOKEN || '').trim();

  // Strict 3-Second Timeout Promise
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Email dispatch exceeded 3s timeout limit')), 3000)
  );

  const dispatchPromise = (async (): Promise<boolean> => {
    // ── 1. PRIMARY EXCLUSIVE TRANSPORT: Gmail REST API over HTTPS Port 443 ──
    if (clientId && clientSecret && refreshToken) {
      try {
        const gmail = getGmailService(clientId, clientSecret, refreshToken);
        const raw = createRawEmail(options, senderName);

        const res = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw },
        });

        const elapsed = Date.now() - startTime;
        console.log(`[Gmail REST API (HTTPS Port 443)] Email delivered in ${elapsed}ms: ${res.data.id} to ${options.to}`);
        return true;
      } catch (apiErr: any) {
        console.error('[Gmail REST API Error]:', apiErr?.message || apiErr);
        return false;
      }
    }

    // ── 2. SECONDARY FALLBACK: Direct SMTP (Only if OAuth2 credentials are unset, max 1500ms) ──
    try {
      const { user, pass } = getCredentials();
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
        connectionTimeout: 1500,
        greetingTimeout: 1500,
        socketTimeout: 1500,
        tls: { rejectUnauthorized: false },
      });

      const info = await transporter.sendMail({
        from: `"${senderName}" <${user}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      const elapsed = Date.now() - startTime;
      console.log(`[Gmail SMTP Port 465 SSL] Email sent in ${elapsed}ms: ${info.messageId} to ${options.to}`);
      return true;
    } catch (smtpErr: any) {
      console.warn('[Gmail SMTP Fallback Note]:', smtpErr?.message || smtpErr);
    }

    return false;
  })();

  try {
    const success = await Promise.race([dispatchPromise, timeoutPromise]);
    if (!success) {
      console.error(`[Email Dispatch Error] Failed to dispatch email to ${options.to}. Ensure GMAIL_* credentials are active.`);
    }
    return success;
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Email Dispatch Timeout / Abort (${elapsed}ms)]: ${err?.message || err}`);
    return false;
  }
}
