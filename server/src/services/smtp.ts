import nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}

const user = (process.env.GMAIL_USER || 'SheDrive.Support@gmail.com').trim();
const rawPass = process.env.GMAIL_APP_PASSWORD || 'pofs asgp bruk yomi';
const pass = rawPass.replace(/\s+/g, '');

/**
 * Robust Multi-Transport Gmail Delivery
 * Primary: Port 465 (Direct SSL) with 10s connection timeout
 * Fallback: Port 587 (STARTTLS) with 10s connection timeout
 */
const transporterSSL = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user, pass },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

const transporterSTARTTLS = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user, pass },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const senderName = options.fromName || 'SheDrive Support';

  const mailOptions = {
    from: `"${senderName}" <${user}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  };

  try {
    const info = await transporterSSL.sendMail(mailOptions);
    console.log(`[Gmail SMTP (SSL 465)] Message delivered: ${info.messageId} to ${options.to}`);
    return true;
  } catch (sslErr: any) {
    console.warn(`[Gmail SMTP (SSL 465)] Failed (${sslErr.message}), falling back to STARTTLS 587...`);
    try {
      const fallbackInfo = await transporterSTARTTLS.sendMail(mailOptions);
      console.log(`[Gmail SMTP (STARTTLS 587)] Message delivered: ${fallbackInfo.messageId} to ${options.to}`);
      return true;
    } catch (starttlsErr: any) {
      console.error(`[Gmail SMTP (STARTTLS 587)] Both ports failed:`, starttlsErr.message || starttlsErr);
      throw starttlsErr;
    }
  }
}
