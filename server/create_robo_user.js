const { pool } = require('./src/config/db.ts');
const bcrypt = require('bcryptjs');

async function createAccount() {
  try {
    const hash = await bcrypt.hash('H18a01m@2005', 10);
    const now = Date.now();
    await pool.query(
      `INSERT INTO users (id, email, password_hash, name, phone, cnic, role, is_verified, is_active, verification_status, created_at, updated_at) 
       VALUES ('test_robo_1', '03000000001', $1, 'Robo Test User', '03000000001', '1234567890123', 'passenger', true, true, 'approved', $2, $2)
       ON CONFLICT (id) DO UPDATE SET password_hash = $1, phone = '03000000001', email = '03000000001';`,
      [hash, now]
    );
    console.log('Account created successfully');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
createAccount();
