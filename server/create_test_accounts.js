const { pool } = require('./src/config/db.ts');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    const hash = await bcrypt.hash('Test#2026', 10);
    const now = Date.now();
    
    // Insert Passengers
    await pool.query(`
      INSERT INTO users (id, email, password_hash, name, phone, role, cnic, is_verified, is_active, verification_status, created_at, updated_at) 
      VALUES 
      ('test_p1', 'p1@test.com', $1, 'Test Pass 1', '03000000001', 'passenger', '1234567890123', true, true, 'approved', $2, $2),
      ('test_p2', 'p2@test.com', $1, 'Test Pass 2', '03000000002', 'passenger', '1234567890124', true, true, 'approved', $2, $2),
      ('test_d1', 'd1@test.com', $1, 'Test Driver 1', '03000000003', 'driver', '1234567890125', true, true, 'approved', $2, $2),
      ('test_d2', 'd2@test.com', $1, 'Test Driver 2', '03000000004', 'driver', '1234567890126', true, true, 'approved', $2, $2)
      ON CONFLICT DO NOTHING
    `, [hash, now]);

    // Insert Drivers
    await pool.query(`
      INSERT INTO drivers (driver_id, vehicle_category, vehicle_make, vehicle_model, vehicle_plate, vehicle_color, vehicle_year, is_online, is_available, last_location_update) 
      VALUES 
      ('test_d1', 'mini', 'Toyota', 'Vitz', 'LEA-123', 'White', 2020, true, true, $1),
      ('test_d2', 'sedan', 'Honda', 'City', 'LEB-456', 'Black', 2021, true, true, $1)
      ON CONFLICT DO NOTHING
    `, [now]);

    console.log('Test accounts created successfully!');
    process.exit(0);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
}
seed();
