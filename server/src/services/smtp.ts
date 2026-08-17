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

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const senderName = options.fromName || 'SheDrive Support';
  const apiKey = (process.env.RESEND_API_KEY || '').trim();

  // ── Primary: Resend HTTP API (works on Render / cloud containers) ───────
  if (apiKey) {
    try {
      const resendClient = new Resend(apiKey);
      const { data, error } = await resendClient.emails.send({
        from: `${senderName} <onboarding@resend.dev>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        console.error('[Resend API] Error from provider:', error);
        throw new Error(error.message || 'Resend delivery failed');
      }

      console.log(`[Resend API] Email delivered successfully: ${data?.id} to ${options.to}`);
      return true;
    } catch (resendErr: any) {
      console.warn(`[Resend API] Warning (${resendErr.message}), falling back to Gmail SMTP...`);
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
