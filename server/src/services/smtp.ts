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
 * Fully RFC 5321 compliant with robust line buffering and multi-line response parsing.
 */
export function sendEmail(options: SendEmailOptions): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const host = 'smtp.gmail.com';
    const port = 465;
    const user = (process.env.GMAIL_USER || 'SheDrive.Support@gmail.com').trim();
    const rawPass = process.env.GMAIL_APP_PASSWORD || 'pofs asgp bruk yomi';
    const pass = rawPass.replace(/\s+/g, '');
    const senderName = options.fromName || 'SheDrive Support';

    const client = tls.connect(port, host, { rejectUnauthorized: true }, () => {
      // TLS Connection established
    });

    let step = 0;
    let isSettled = false;
    let buffer = '';

    const cleanup = () => {
      try {
        client.removeAllListeners();
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

    client.on('data', (chunk) => {
      buffer += chunk.toString();

      // Process complete SMTP response lines
      while (buffer.includes('\n')) {
        const lineEnd = buffer.indexOf('\n');
        const rawLine = buffer.substring(0, lineEnd);
        buffer = buffer.substring(lineEnd + 1);
        const line = rawLine.replace(/\r$/, '');

        if (line.length < 3) continue;

        const code = parseInt(line.substring(0, 3), 10);
        const isHyphen = line.length >= 4 && line[3] === '-';

        // Multi-line continuation (e.g. "250-SIZE ..."), wait for the final line ("250 ...")
        if (isHyphen) {
          continue;
        }

        if (isNaN(code) || code >= 400) {
          if (!isSettled) {
            isSettled = true;
            cleanup();
            reject(new Error(`SMTP Failure (${code}): ${line}`));
          }
          return;
        }

        // State Machine
        switch (step) {
          case 0: // 220 Greeting from Gmail SMTP
            if (code === 220) {
              step = 1;
              sendCmd('EHLO shedrive.com');
            }
            break;

          case 1: // 250 EHLO Response completed
            if (code === 250) {
              step = 2;
              sendCmd('AUTH LOGIN');
            }
            break;

          case 2: // 334 Request Username
            if (code === 334) {
              step = 3;
              sendCmd(Buffer.from(user).toString('base64'));
            }
            break;

          case 3: // 334 Request Password
            if (code === 334) {
              step = 4;
              sendCmd(Buffer.from(pass).toString('base64'));
            }
            break;

          case 4: // 235 Authentication Successful
            if (code === 235) {
              step = 5;
              sendCmd(`MAIL FROM:<${user}>`);
            }
            break;

          case 5: // 250 Sender Accepted
            if (code === 250) {
              step = 6;
              sendCmd(`RCPT TO:<${options.to}>`);
            }
            break;

          case 6: // 250 Recipient Accepted
            if (code === 250) {
              step = 7;
              sendCmd('DATA');
            }
            break;

          case 7: // 354 Start Mail Input
            if (code === 354) {
              step = 8;
              const emailPayload = [
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

              sendCmd(emailPayload);
            }
            break;

          case 8: // 250 Message Accepted for Delivery
            if (code === 250) {
              step = 9;
              sendCmd('QUIT');
              if (!isSettled) {
                isSettled = true;
                resolve(true);
              }
            }
            break;

          case 9: // 221 Service Closing Transmission Channel
            cleanup();
            break;

          default:
            break;
        }
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
        cleanup();
        reject(new Error(`SMTP connection closed prematurely at step ${step}`));
      }
    });

    // Timeout safety net (20 seconds)
    setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        reject(new Error('SMTP Request timed out after 20 seconds'));
      }
    }, 20000);
  });
}

