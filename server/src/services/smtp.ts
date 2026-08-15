import tls from 'tls';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}

/**
 * Native Node.js TLS SMTP Email Sender (Zero External Dependencies)
 * Sends emails directly via Gmail SMTP (smtp.gmail.com:465) using Node.js built-in tls module.
 */
export function sendEmail(options: SendEmailOptions): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const host = 'smtp.gmail.com';
    const port = 465;
    const user = process.env.GMAIL_USER || 'SheDrive.Support@gmail.com';
    const rawPass = process.env.GMAIL_APP_PASSWORD || 'pofs asgp bruk yomi';
    // Remove spaces from app password if any exist
    const pass = rawPass.replace(/\s+/g, '');
    const senderName = options.fromName || 'SheDrive Support';

    const client = tls.connect(port, host, { rejectUnauthorized: true }, () => {
      // TLS connection established
    });

    let step = 0;
    let isSettled = false;

    const cleanup = () => {
      try {
        client.end();
        client.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
    };

    const sendCmd = (cmd: string) => {
      client.write(cmd + '\r\n');
    };

    client.setEncoding('utf8');

    client.on('data', (data) => {
      const response = data.toString();
      const code = parseInt(response.substring(0, 3), 10);

      if (isNaN(code) || code >= 400) {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          reject(new Error(`SMTP Failure (${code}): ${response.trim()}`));
        }
        return;
      }

      switch (step) {
        case 0: // 220 Greeting from Gmail SMTP
          step++;
          sendCmd('EHLO shedrive.com');
          break;

        case 1: // 250 EHLO Response
          step++;
          sendCmd('AUTH LOGIN');
          break;

        case 2: // 334 Request Username
          step++;
          sendCmd(Buffer.from(user).toString('base64'));
          break;

        case 3: // 334 Request Password
          step++;
          sendCmd(Buffer.from(pass).toString('base64'));
          break;

        case 4: // 235 Authentication Successful
          step++;
          sendCmd(`MAIL FROM:<${user}>`);
          break;

        case 5: // 250 Sender Accepted
          step++;
          sendCmd(`RCPT TO:<${options.to}>`);
          break;

        case 6: // 250 Recipient Accepted
          step++;
          sendCmd('DATA');
          break;

        case 7: // 354 Start Mail Input
          step++;
          const headers = [
            `From: "${senderName}" <${user}>`,
            `To: <${options.to}>`,
            `Subject: ${options.subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            'X-Mailer: SheDrive Node Native SMTP Transport',
            '',
            options.html,
            '.',
          ].join('\r\n');

          sendCmd(headers);
          break;

        case 8: // 250 Message Accepted for Delivery
          step++;
          sendCmd('QUIT');
          if (!isSettled) {
            isSettled = true;
            resolve(true);
          }
          break;

        case 9: // 221 Service Closing Transmission Channel
          cleanup();
          break;

        default:
          break;
      }
    });

    client.on('error', (err) => {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        reject(err);
      }
    });

    client.on('close', () => {
      if (!isSettled && step < 8) {
        isSettled = true;
        reject(new Error('SMTP Connection closed prematurely'));
      }
    });

    // Timeout safety net (15 seconds)
    setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        reject(new Error('SMTP Request timed out after 15 seconds'));
      }
    }, 15000);
  });
}
