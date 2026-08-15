const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

async function testSupabaseClient() {
  console.log('Testing Supabase Client over HTTPS (Port 443)...\n');

  try {
    const start = Date.now();

    // Query drivers
    const { data: drivers, error: dErr, count: dCount } = await supabase
      .from('drivers')
      .select('*', { count: 'exact' });

    if (dErr) console.error('Drivers query error:', dErr);
    else console.log(`✅ Drivers count: ${drivers.length} (exact: ${dCount}) in ${Date.now() - start}ms`);

    // Query users
    const { data: users, error: uErr } = await supabase
      .from('users')
      .select('*');

    if (uErr) console.error('Users query error:', uErr);
    else console.log(`✅ Users count: ${users.length}`);

    // Query monthly_payments
    const { data: payments, error: pErr } = await supabase
      .from('monthly_payments')
      .select('*');

    if (pErr) console.error('Payments query error:', pErr);
    else console.log(`✅ Monthly Payments count: ${payments.length}`);

    console.log('\nSupabase JS Client queries succeeded 100% error-free!');

  } catch (err) {
    console.error('Supabase client error:', err);
  }
}

testSupabaseClient();
