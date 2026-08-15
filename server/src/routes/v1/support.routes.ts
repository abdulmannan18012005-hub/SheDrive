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
 * GET /api/v1/support/tickets
 * Headers: Authorization: Bearer <token>
 */
router.get('/tickets', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const result = await query(
      'SELECT id, category, subject, message, status, created_at FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.status(200).json({ tickets: result.rows });
  } catch (error) {
    console.error('Fetch support tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch support tickets' });
  }
});

export default router;
