import nodemailer from 'nodemailer';
import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}

const gmailUser = (process.env.GMAIL_USER || 'SheDrive.Support@gmail.com').trim();
const gmailPass = (process.env.GMAIL_APP_PASSWORD || 'pofs asgp bruk yomi').replace(/\s+/g, '');

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
        console.error('[Resend API] Provider Error:', JSON.stringify(error));
        const errMsg = typeof error === 'object' ? (error.message || JSON.stringify(error)) : String(error);
        throw new Error(`Resend Error: ${errMsg}`);
      }

      console.log(`[Resend API] Email delivered successfully: ${data?.id} to ${options.to}`);
      return true;
    } catch (resendErr: any) {
      console.error(`[Resend API] Failed:`, resendErr.message || resendErr);
      throw new Error(`Resend failed: ${resendErr.message || resendErr}`);
    }
  }

  // ── Fallback: Gmail SMTP via Nodemailer (only when RESEND_API_KEY is NOT set) ──
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
