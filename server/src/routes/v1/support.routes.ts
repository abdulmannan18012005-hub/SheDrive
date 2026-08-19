import { Router, Request, Response } from 'express';
import { query } from '../../config/db';
import { authenticateToken } from '../../middleware/auth';

const router = Router();

/**
 * GET /api/v1/support/faqs
 * Description: Retrieves list of frequently asked questions and answers.
 */
router.get('/faqs', (_req: Request, res: Response) => {
  const faqs = [
    {
      id: 'faq_1',
      question: 'Is SheDrive strictly for female passengers and female drivers?',
      answer: 'Yes! SheDrive is Pakistan\'s dedicated female-only ride-hailing network. Both passengers and driver partners are verified female community members.',
    },
    {
      id: 'faq_2',
      question: 'How does the Ride Verification PIN work?',
      answer: 'Upon ride acceptance, a 4-digit PIN is generated on your app. Show this PIN to your driver upon entering the vehicle. The driver will enter the PIN to start the ride.',
    },
    {
      id: 'faq_3',
      question: 'What should I do in an emergency?',
      answer: 'Tap the red "🚨 EMERGENCY SOS" button on the active ride screen. This broadcasts your live location to the SheDrive Admin Command Center and triggers automated alert SMS to your emergency contacts.',
    },
    {
      id: 'faq_4',
      question: 'How do fare offers and counter-bids work?',
      answer: 'SheDrive uses a fair fare negotiation engine. Riders offer their price, and nearby drivers can accept or submit counter-offers (+5 / -5 PKR steps). You choose the driver and fare that suits you.',
    },
  ];

  res.status(200).json({ faqs });
});

/**
 * POST /api/v1/support/tickets
 * Headers: Authorization: Bearer <token>
 * Body: { category: string, subject: string, message: string }
 */
router.post('/tickets', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { category, subject, message } = req.body;

    if (!category || !subject || !message) {
      return res.status(400).json({ error: 'Category, subject, and message are required' });
    }

    const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    await query(
      `INSERT INTO support_tickets (id, user_id, category, subject, message, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'open', $6)`,
      [ticketId, userId, category.trim(), subject.trim(), message.trim(), now]
    );

    res.status(201).json({
      success: true,
      ticket: { id: ticketId, userId, category, subject, message, status: 'open', createdAt: now },
    });
  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({ error: 'Failed to submit support ticket' });
  }
});

/**
 * POST /api/v1/support/feedback
 * Headers: Authorization: Bearer <token>
 * Body: { rating: number, category: string, comment: string, appVersion?: string, deviceInfo?: string }
 * Description: Submits user/driver feedback linked via Foreign Key to users(id).
 */
router.post('/feedback', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;
    const { rating, category, comment, appVersion, deviceInfo } = req.body;

    if (!rating || !comment || !comment.trim()) {
      return res.status(400).json({ error: 'Rating (1-5) and feedback comment are required' });
    }

    const ratingNum = Math.min(5, Math.max(1, parseInt(rating, 10) || 5));
    const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    // Query user name and role if available
    let userName = user.name || 'Community Member';
    let userRole = user.role || 'passenger';

    const userRes = await query('SELECT name, role FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length > 0) {
      userName = userRes.rows[0].name || userName;
      userRole = userRes.rows[0].role || userRole;
    }

    // Insert into PostgreSQL feedbacks table (attached via FK to users.id)
    await query(
      `INSERT INTO feedbacks (
        id, user_id, user_role, user_name, rating, category, comment,
        app_version, device_info, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', $10)`,
      [
        feedbackId,
        userId,
        userRole,
        userName,
        ratingNum,
        category?.trim() || 'General Suggestion',
        comment.trim(),
        appVersion || '1.0.0',
        deviceInfo || 'Mobile App',
        now,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Thank you for your valuable feedback! The SheDrive team reviews every submission.',
      feedbackId,
    });
  } catch (error: any) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

/**
 * GET /api/v1/support/feedback
 * Headers: Authorization: Bearer <token>
 * Description: Fetches feedbacks submitted by the logged-in user.
 */
router.get('/feedback', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const result = await query(
      'SELECT id, rating, category, comment, status, created_at FROM feedbacks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.status(200).json({ feedbacks: result.rows });
  } catch (error) {
    console.error('Fetch user feedback error:', error);
    res.status(500).json({ error: 'Failed to fetch feedbacks' });
  }
});

export default router;
