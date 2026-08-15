import { Router, Request, Response } from 'express';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'SheDrive Backend API',
    version: 'v1',
    timestamp: Date.now(),
    uptimeSeconds: process.uptime(),
  });
});

export default router;
