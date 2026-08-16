import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { query } from '../../config/db';
import { sendPushNotification } from '../../services/notificationService';

const router = Router();

// Save FCM token
router.post('/token', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user?.id;

    if (!fcmToken) {
      return res.status(400).json({ error: 'FCM token is required' });
    }

    await query(
      'UPDATE users SET fcm_token = $1 WHERE id = $2',
      [fcmToken, userId]
    );

    res.status(200).json({ message: 'Token saved successfully' });
  } catch (error) {
    console.error('Failed to save FCM token:', error);
    res.status(500).json({ error: 'Failed to save token' });
  }
});

// Test notification
router.post('/test', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    await sendPushNotification({
      userId,
      title: 'Test Notification',
      body: 'This is a test notification from SheDrive',
      data: { type: 'test' },
    });
    
    res.json({ message: 'Test notification sent' });
  } catch (error) {
    console.error('Failed to send test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

export default router;
