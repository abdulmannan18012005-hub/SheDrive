import nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}

/**
 * Standard Gmail SMTP Email Transport
 * Uses official nodemailer transport for smtp.gmail.com with SSL/TLS.
 */
const user = (process.env.GMAIL_USER || 'SheDrive.Support@gmail.com').trim();
const rawPass = process.env.GMAIL_APP_PASSWORD || 'pofs asgp bruk yomi';
const pass = rawPass.replace(/\s+/g, '');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user,
    pass,
  },
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
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Nodemailer SMTP] Message sent: ${info.messageId} to ${options.to}`);
    return true;
  } catch (error: any) {
    console.error('[Nodemailer SMTP] sendMail error:', error.message || error);
    throw error;
  }
}
