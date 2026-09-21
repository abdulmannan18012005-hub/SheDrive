const { pool } = require('./src/config/db.ts');
pool.query("SELECT role, email FROM users WHERE phone = '03000000001'").then(res => { console.log(res.rows); process.exit(0); });
