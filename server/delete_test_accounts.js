const { pool } = require('./src/config/db.ts');
async function teardown() {
  try {
    await pool.query("DELETE FROM users WHERE email IN ('p1@test.com', 'p2@test.com', 'd1@test.com', 'd2@test.com')");
    console.log('Test accounts deleted successfully!');
    process.exit(0);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
}
teardown();
