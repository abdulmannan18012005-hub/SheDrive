import { Router, Request, Response } from 'express';

const router = Router();

const handleHealth = (req: Request, res: Response) => {
  const hasGmailApi = Boolean(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN
  );
  res.status(200).json({
    status: 'ok',
    service: 'SheDrive Backend API',
    version: 'v1',
    gmailApiConfigured: hasGmailApi,
    timestamp: Date.now(),
    uptimeSeconds: process.uptime(),
  });
};

router.get('/', handleHealth);
router.get('/health', handleHealth);

export default router;
