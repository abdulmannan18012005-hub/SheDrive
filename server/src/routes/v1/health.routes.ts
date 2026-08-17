import { Router, Request, Response } from 'express';

const router = Router();

const handleHealth = (req: Request, res: Response) => {
  const hasResend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 0);
  res.status(200).json({
    status: 'ok',
    service: 'SheDrive Backend API',
    version: 'v1',
    resendConfigured: hasResend,
    timestamp: Date.now(),
    uptimeSeconds: process.uptime(),
  });
};

router.get('/', handleHealth);
router.get('/health', handleHealth);

export default router;
