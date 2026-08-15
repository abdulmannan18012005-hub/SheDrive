const { setGlobalDispatcher, Agent } = require('undici');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config();

setGlobalDispatcher(new Agent({
  keepAliveTimeout: 60000,
  keepAliveMaxTimeout: 60000,
  connections: 50,
}));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

async function testParallelStats() {
  console.log('Testing Parallel Execution for /admin/stats metrics...\n');

  const start = Date.now();

  const [onlineDrivers, completedRides, pendingVerifications, totalPassengers, activeRides] = await Promise.all([
    supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('is_online', true),
    supabase.from('rides').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'driver').eq('is_verified', false),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'passenger'),
    supabase.from('rides').select('*', { count: 'exact', head: true }).in('status', ['requested', 'negotiating', 'accepted', 'arrived', 'in_progress']),
  ]);

  const totalMs = Date.now() - start;

  console.log(`⚡ ALL 5 STATS METRICS COMPLETED IN PARALLEL IN ONLY ${totalMs}ms!`);
  console.log({
    onlineDrivers: onlineDrivers.count || 0,
    completedRides: completedRides.count || 0,
    pendingVerifications: pendingVerifications.count || 0,
    totalPassengers: totalPassengers.count || 0,
    activeRides: activeRides.count || 0,
  });
}

testParallelStats();
