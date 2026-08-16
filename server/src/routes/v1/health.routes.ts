import { Router, Request, Response } from 'express';

const router = Router();

const handleHealth = (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'SheDrive Backend API',
    version: 'v1',
    timestamp: Date.now(),
    uptimeSeconds: process.uptime(),
  });
};

router.get('/', handleHealth);
router.get('/health', handleHealth);

export default router;
