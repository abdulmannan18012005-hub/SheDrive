import bcrypt from 'bcryptjs';
import { query } from '../src/config/db';

async function testCurrentDbHash() {
  try {
    const res = await query("SELECT password_hash FROM users WHERE email = 'admin@shedrive.com'");
    if (res.rows.length === 0) {
      console.log("No admin user found in DB!");
      return;
    }
    const hash = res.rows[0].password_hash;
    console.log("Current DB Hash:", hash);

    const testPasses = ["Admin#2026!", "NewSecretPass#2026", "TestPass789", "MyNewPass2026!"];
    for (const p of testPasses) {
      const match = await bcrypt.compare(p, hash);
      console.log(`Password '${p}' match result:`, match);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

testCurrentDbHash();
