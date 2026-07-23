import { Router, Request, Response } from 'express';
import { query } from '../../config/db';
import { generateToken, hashPassword, comparePassword } from '../../middleware/auth';

const router = Router();

// Register new User / Driver
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone, role, cnic, vehicleInfo } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Missing required registration parameters' });
    }

    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const passHash = await hashPassword(password);
    const now = Date.now();

    await query(
      `INSERT INTO users (id, email, password_hash, name, phone, role, cnic, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, email, passHash, name, phone || '', role, cnic || null, now, now]
    );

    // If driver, insert vehicle info record
    if (role === 'driver' && vehicleInfo) {
      await query(
        `INSERT INTO drivers (driver_id, vehicle_category, vehicle_make, vehicle_model, vehicle_plate, vehicle_color, last_location_update)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          vehicleInfo.category || 'mini',
          vehicleInfo.make || '',
          vehicleInfo.model || '',
          vehicleInfo.plate || '',
          vehicleInfo.color || '',
          now,
        ]
      );
    }

    const token = generateToken({ id: userId, email, role });

    res.status(201).json({
      user: { id: userId, email, name, phone, role, cnic },
      token,
    });
  } catch (error) {
    console.error('Registration API error:', error);
    res.status(500).json({ error: 'Failed to complete registration' });
  }
});

// Login User
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        cnic: user.cnic,
      },
      token,
    });
  } catch (error) {
    console.error('Login API error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
