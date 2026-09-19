import { Router, Request, Response } from 'express';
import { query } from '../../config/db';
import { authenticateToken } from '../../middleware/auth';
import { feedbackRateLimiter } from '../../middleware/rateLimiter';

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
 * GET /api/v1/support/tickets
 * Headers: Authorization: Bearer <token>
 * Description: Fetches all tickets for the logged-in user.
 */
router.get('/tickets', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const result = await query(
      'SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.status(200).json({ tickets: result.rows });
  } catch (error) {
    console.error('Fetch tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

/**
 * GET /api/v1/support/tickets/:id/messages
 * Headers: Authorization: Bearer <token>
 * Description: Fetches messages for a specific ticket.
 */
router.get('/tickets/:id/messages', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const ticketId = req.params.id;

    // Verify ticket ownership
    const ticketRes = await query('SELECT user_id FROM support_tickets WHERE id = $1', [ticketId]);
    if (ticketRes.rows.length === 0 || ticketRes.rows[0].user_id !== userId) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const messagesRes = await query(
      'SELECT * FROM support_chat_messages WHERE ticket_id = $1 ORDER BY created_at ASC',
      [ticketId]
    );

    res.status(200).json({ messages: messagesRes.rows });
  } catch (error) {
    console.error('Fetch ticket messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/v1/support/tickets/:id/messages
 * Headers: Authorization: Bearer <token>
 * Body: { text: string }
 * Description: Adds a new message to a specific ticket.
 */
router.post('/tickets/:id/messages', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const ticketId = req.params.id;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    // Verify ticket ownership
    const ticketRes = await query('SELECT user_id FROM support_tickets WHERE id = $1', [ticketId]);
    if (ticketRes.rows.length === 0 || ticketRes.rows[0].user_id !== userId) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    await query(
      `INSERT INTO support_chat_messages (id, ticket_id, sender_id, text, is_from_admin, created_at)
       VALUES ($1, $2, $3, $4, false, $5)`,
      [messageId, ticketId, userId, text.trim(), now]
    );

    res.status(201).json({
      success: true,
      message: { id: messageId, ticket_id: ticketId, sender_id: userId, text: text.trim(), is_from_admin: false, created_at: now },
    });
  } catch (error) {
    console.error('Create ticket message error:', error);
    res.status(500).json({ error: 'Failed to submit message' });
  }
});

/**
 * DELETE /api/v1/support/tickets/:id
 * Headers: Authorization: Bearer <token>
 * Description: Deletes a specific ticket.
 */
router.delete('/tickets/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const ticketId = req.params.id;

    // Verify ticket ownership
    const ticketRes = await query('SELECT user_id FROM support_tickets WHERE id = $1', [ticketId]);
    if (ticketRes.rows.length === 0 || ticketRes.rows[0].user_id !== userId) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    await query('DELETE FROM support_tickets WHERE id = $1', [ticketId]);
    res.status(200).json({ success: true, message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

/**
 * POST /api/v1/support/tickets
 * Headers: Authorization: Bearer <token>
 * Body: { category: string, subject: string, message: string }
 */
router.post('/tickets', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { category, subject, message, screenshotUrl } = req.body;

    if (!category || !subject || !message) {
      return res.status(400).json({ error: 'Category, subject, and message are required' });
    }

    const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    // Insert the ticket
    await query(
      `INSERT INTO support_tickets (id, user_id, category, subject, message, screenshot_url, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)`,
      [ticketId, userId, category.trim(), subject.trim(), message.trim(), screenshotUrl || null, now]
    );

    // Insert the initial message into support_chat_messages
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await query(
      `INSERT INTO support_chat_messages (id, ticket_id, sender_id, text, is_from_admin, created_at)
       VALUES ($1, $2, $3, $4, false, $5)`,
      [messageId, ticketId, userId, message.trim(), now]
    );

    res.status(201).json({
      success: true,
      ticket: { id: ticketId, userId, category, subject, message, screenshotUrl: screenshotUrl || null, status: 'open', createdAt: now },
    });
  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({ error: 'Failed to submit support ticket' });
  }
});

/**
 * POST /api/v1/support/feedback
 * Headers: Optional Authorization: Bearer <token>
 * Body: { rating: number, category: string, comment: string, name?: string, phone?: string, email?: string, appVersion?: string, deviceInfo?: string }
 * Description: Submits user/driver/website feedback linked to users(id) or guest profile.
 */
router.post('/feedback', feedbackRateLimiter, async (req: Request, res: Response) => {
  try {
    const { rating, category, comment, name, phone, email, appVersion, deviceInfo } = req.body;

    if (!rating || !comment || !comment.trim()) {
      return res.status(400).json({ error: 'Rating (1-5) and feedback comment are required' });
    }

    let userId: string | null = null;
    let userName = name || 'Community Member';
    let userRole = 'passenger';

    // Check if authenticated via JWT token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        if (decoded && decoded.id) {
          userId = decoded.id;
          const userRes = await query('SELECT id, name, role, phone FROM users WHERE id = $1', [userId]);
          if (userRes.rows.length > 0) {
            userName = userRes.rows[0].name || userName;
            userRole = userRes.rows[0].role || userRole;
          }
        }
      } catch (jwtErr) {
        // Invalid or expired token; fallback to guest submission
      }
    }

    // If submitted from website without auth, check if user exists by email/phone or create guest entry
    if (!userId) {
      if (email || phone) {
        const matchRes = await query(
          'SELECT id, name, role FROM users WHERE email = $1 OR phone = $2 LIMIT 1',
          [email || null, phone || null]
        );
        if (matchRes.rows.length > 0) {
          userId = matchRes.rows[0].id;
          userName = matchRes.rows[0].name || userName;
          userRole = matchRes.rows[0].role || userRole;
        }
      }

      // If still no matching user in DB, link to primary admin or create transient guest record
      if (!userId) {
        const adminLookup = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
        userId = adminLookup.rows.length > 0 ? adminLookup.rows[0].id : 'usr_guest_web';
      }
    }

    const ratingNum = Math.min(5, Math.max(1, parseInt(rating, 10) || 5));
    const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    // Insert into PostgreSQL feedbacks table
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
        deviceInfo || 'Website / Web Portal',
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

/**
 * POST /api/v1/support/ai-chat
 * Description: Proxy to Gemini API for AI Customer Care
 */
router.post('/ai-chat', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY is not set in environment.');
      return res.status(500).json({ error: 'AI Support is currently unavailable' });
    }

    const systemPrompt = `You are the SheDrive AI Customer Care Assistant. 
SheDrive is Pakistan's exclusive female-only ride-hailing platform.
Your tone should be professional, empathetic, and helpful.
If asked about driver requirements: Female only, valid CNIC, driving license, and vehicle registration.
If asked about safety: We offer a built-in SOS button, live ride sharing, and strictly verified female users.
If asked about fares: Fares are determined by a bidding system between the passenger and driver.
Do not promise refunds; advise them to submit a support ticket via the app.
Be concise and clear in your responses.`;

    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Understood. How can I assist you today?' }] }
    ];

    for (const msg of messages) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      });
    }

      let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 250, temperature: 0.3 } })
      });

      if (!response.ok) {
        // Fallback to gemini-1.5-flash if 2.0-flash-lite is rejected/not available
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 250, temperature: 0.3 } })
        });
      }

      const data = await response.json();
    
    if (!response.ok) {
      console.error('Gemini API Error:', data);
      return res.status(500).json({ error: 'Failed to generate response' });
    }

    const aiMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I apologize, but I am unable to process your request at the moment.';
    res.status(200).json({ text: aiMessage });

  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ error: 'Internal server error during AI chat' });
  }
});

export default router;
