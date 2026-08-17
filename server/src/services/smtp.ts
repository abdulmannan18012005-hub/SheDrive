import nodemailer from 'nodemailer';
import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}

// ─── Configuration ───────────────────────────────────────────────
const gmailUser = (process.env.GMAIL_USER || 'SheDrive.Support@gmail.com').trim();
const gmailPass = (process.env.GMAIL_APP_PASSWORD || 'pofs asgp bruk yomi').replace(/\s+/g, '');
const resendApiKey = process.env.RESEND_API_KEY || '';

// ─── Resend HTTP Transport (works on Render free tier) ──────────
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// ─── Nodemailer SMTP Transport (works locally / paid hosting) ───
const smtpTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: gmailUser, pass: gmailPass },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

/**
 * Send email via best available transport:
 *  1. Resend HTTP API (if RESEND_API_KEY is set — works on Render free tier)
 *  2. Gmail SMTP via Nodemailer (fallback for local dev / paid hosting)
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const senderName = options.fromName || 'SheDrive Support';

  // ── Primary: Resend HTTP API ─────────────────────────────────
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: `${senderName} <onboarding@resend.dev>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        console.error('[Resend API] Error:', error);
        throw new Error(error.message || 'Resend API error');
      }

      console.log(`[Resend API] Email sent: ${data?.id} to ${options.to}`);
      return true;
    } catch (resendErr: any) {
      console.warn(`[Resend API] Failed (${resendErr.message}), falling back to Gmail SMTP...`);
      // Fall through to SMTP below
    }
  }

  // ── Fallback: Gmail SMTP via Nodemailer ──────────────────────
  try {
    const info = await smtpTransporter.sendMail({
      from: `"${senderName}" <${gmailUser}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(`[Gmail SMTP] Email sent: ${info.messageId} to ${options.to}`);
    return true;
  } catch (smtpErr: any) {
    console.error('[Gmail SMTP] sendMail error:', smtpErr.message || smtpErr);
    throw smtpErr;
  }
}
