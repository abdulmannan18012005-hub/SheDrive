const { pool } = require('./src/config/db.ts');
pool.query("DELETE FROM users WHERE email = 'p1@test.com'").then(() => { console.log('Cleaned'); process.exit(0); });
