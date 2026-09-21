const { pool } = require('./src/config/db.ts');
const bcrypt = require('bcryptjs');

async function createDriver() {
  try {
    const hash = await bcrypt.hash('H18a01m@2005', 10);
    const now = Date.now();
    await pool.query(
      `INSERT INTO users (id, email, password_hash, name, phone, cnic, role, is_verified, is_active, verification_status, created_at, updated_at) 
       VALUES ('test_robo_2', 'robo_driver@test.com', $1, 'Robo Test Driver', '03000000001', '1234567890124', 'driver', true, true, 'approved', $2, $2)
       ON CONFLICT (email) DO UPDATE SET password_hash = $1, phone = '03000000001';`,
      [hash, now]
    );
    await pool.query(
      `INSERT INTO drivers (driver_id, vehicle_category, vehicle_make, vehicle_model, vehicle_plate, vehicle_color, vehicle_year, is_online, is_available, last_location_update) 
       VALUES ('test_robo_2', 'mini', 'Toyota', 'Vitz', 'ROBO-123', 'White', 2020, true, true, $1)
       ON CONFLICT (driver_id) DO NOTHING;`,
      [now]
    );
    console.log('Driver created successfully');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
createDriver();
