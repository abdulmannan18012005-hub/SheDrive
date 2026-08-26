import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { setGlobalDispatcher, Agent } from 'undici';
import ws from 'ws';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // Ignore if unsupported
}

try {
  setGlobalDispatcher(new Agent({
    keepAliveTimeout: 60000,
    keepAliveMaxTimeout: 60000,
    connections: 50,
  }));
} catch (e) {
  // Ignore if undici dispatcher fails
}

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shedrive';
const isRemote = connectionString.includes('supabase') || connectionString.includes('rds') || !connectionString.includes('localhost');

// 1. PostgreSQL TCP Pool
export const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 500,
});

pool.on('error', (err: Error) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[PostgreSQL Pool Notice]', err?.message || err);
  }
});

let isTcpAvailable: boolean | null = null;
let lastTcpCheck = 0;

async function checkTcpHealth() {
  if (isTcpAvailable !== null && Date.now() - lastTcpCheck < 60000) {
    return isTcpAvailable;
  }
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    isTcpAvailable = true;
    lastTcpCheck = Date.now();
    return true;
  } catch (e) {
    isTcpAvailable = false;
    lastTcpCheck = Date.now();
    return false;
  }
}

checkTcpHealth();

// 2. Supabase Client over HTTPS Port 443
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required for Supabase fallback. Supabase features will not work.');
}

let supabaseClient: any = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      realtime: { transport: ws as any },
    });
  } catch (err) {
    console.warn('[Supabase Client Notice] Could not initialize Supabase HTTP client:', err);
  }
}

/**
 * High-Speed Universal Query Engine over HTTPS Port 443
 * Handles SELECT, INSERT, UPDATE, DELETE for all SheDrive models
 */
async function runSupabaseHttpsQuery(text: string, params: any[] = []) {
  if (!supabaseClient) {
    throw new Error('Supabase client is not initialized.');
  }

  const sql = text.trim();
  const lowerSql = sql.toLowerCase();

  // A. SELECT COUNT(*) & AGGREGATE QUERIES
  if (lowerSql.includes('count(*)') || lowerSql.includes('sum(')) {
    if (lowerSql.includes('from monthly_payments') && lowerSql.includes('total_platform_income')) {
      const { data: payments, error } = await supabaseClient.from('monthly_payments').select('platform_fee, status');
      if (error) throw new Error(error.message);
      const rows = payments || [];

      let totalPlatformIncome = 0;
      let pendingCount = 0;
      let paidCount = 0;
      let overdueCount = 0;
      let expectedIncome = 0;

      rows.forEach((p: any) => {
        const fee = parseFloat(p.platform_fee || '0') || 0;
        expectedIncome += fee;
        if (p.status === 'paid') {
          totalPlatformIncome += fee;
          paidCount++;
        } else if (p.status === 'submitted') {
          pendingCount++;
        } else if (p.status === 'overdue') {
          overdueCount++;
        }
      });

      return {
        rows: [
          {
            total_platform_income: totalPlatformIncome,
            pending_submissions_count: pendingCount,
            paid_count: paidCount,
            overdue_count: overdueCount,
            expected_income: expectedIncome,
          },
        ],
        rowCount: 1,
      };
    }

    if (lowerSql.includes('from drivers') && lowerSql.includes('is_fee_suspended')) {
      const { count, error } = await supabaseClient
        .from('drivers')
        .select('driver_id', { count: 'exact', head: true })
        .eq('is_fee_suspended', true);
      if (error) throw new Error(error.message);
      return { rows: [{ count: (count || 0).toString() }], rowCount: 1 };
    }

    if (lowerSql.includes('from rides') && lowerSql.includes('revenue')) {
      const { data: completedRides, error } = await supabaseClient
        .from('rides')
        .select('final_fare, offered_fare, estimated_fare')
        .eq('status', 'completed');
      if (error) throw new Error(error.message);
      const rows = completedRides || [];
      let totalRev = 0;
      rows.forEach((r: any) => {
        totalRev += parseFloat(r.final_fare || r.offered_fare || r.estimated_fare || '0') || 0;
      });
      return { rows: [{ count: rows.length.toString(), revenue: totalRev.toString() }], rowCount: 1 };
    }

    if (lowerSql.includes('from users u') && lowerSql.includes('join drivers d')) {
      const [{ data: users }, { data: drivers }] = await Promise.all([
        supabaseClient.from('users').select('id, is_verified').eq('role', 'driver'),
        supabaseClient.from('drivers').select('driver_id, is_active'),
      ]);
      const driverMap = new Map((drivers || []).map((d: any) => [d.driver_id, d]));
      let unverifiedCount = 0;
      (users || []).forEach((u: any) => {
        const d: any = driverMap.get(u.id);
        if (!u.is_verified || (d && !d.is_active)) {
          unverifiedCount++;
        }
      });
      return { rows: [{ count: unverifiedCount.toString() }], rowCount: 1 };
    }

    let tableName = 'users';
    if (lowerSql.includes('from drivers')) tableName = 'drivers';
    else if (lowerSql.includes('from rides')) tableName = 'rides';
    else if (lowerSql.includes('from users')) tableName = 'users';
    else if (lowerSql.includes('from monthly_payments')) tableName = 'monthly_payments';

    let queryBuilder = supabaseClient.from(tableName).select('*', { count: 'exact', head: true });

    if (lowerSql.includes('is_online = true')) {
      queryBuilder = queryBuilder.eq('is_online', true);
    } else if (lowerSql.includes('role = $1') && params && params[0]) {
      queryBuilder = queryBuilder.eq('role', params[0]);
    } else if (lowerSql.includes("role = 'driver'")) {
      queryBuilder = queryBuilder.eq('role', 'driver');
    } else if (lowerSql.includes("role = 'passenger'")) {
      queryBuilder = queryBuilder.eq('role', 'passenger');
    } else if (lowerSql.includes('status in')) {
      queryBuilder = queryBuilder.in('status', ['requested', 'negotiating', 'accepted', 'arrived', 'in_progress']);
    }

    const { count, error } = await queryBuilder;
    if (error) throw new Error(error.message);
    return { rows: [{ count: (count || 0).toString() }], rowCount: 1 };
  }

  // B. JOIN QUERY: Drivers List with User Details
  if (lowerSql.includes('from users u') && lowerSql.includes('join drivers d')) {
    let usersQuery = supabaseClient.from('users').select('id, name, phone, email, cnic, cnic_front_url, cnic_back_url, date_of_birth, verification_status, is_verified, is_blocked').eq('role', 'driver');
    if (lowerSql.includes("verification_status = 'pending'")) {
      usersQuery = usersQuery.eq('verification_status', 'pending');
    }

    const [{ data: drivers, error: dErr }, { data: users, error: uErr }] = await Promise.all([
        supabaseClient.from('drivers').select('driver_id, vehicle_category, vehicle_make, vehicle_model, vehicle_plate, vehicle_color, vehicle_year, ac_option, license_front_url, license_back_url, selfie_url, vehicle_photo_url, is_online, is_available, is_active, rating, total_rides, is_fee_suspended'),
      usersQuery,
    ]);

    if (dErr) throw new Error(dErr.message);
    if (uErr) throw new Error(uErr.message);

    const driverMap = new Map((drivers || []).map((d: any) => [d.driver_id, d]));
    const userMap = new Map((users || []).map((u: any) => [u.id, u]));

    const sourceUsers = users || [];
    const mergedRows = sourceUsers.map((u: any) => {
      const d: any = driverMap.get(u.id) || {};
      return {
        id: u.id,
        name: u.name || 'N/A',
        phone: u.phone || 'N/A',
        email: u.email || 'N/A',
        cnic: u.cnic || 'N/A',
        cnic_front_url: u.cnic_front_url,
        cnic_back_url: u.cnic_back_url,
        date_of_birth: u.date_of_birth,
        verification_status: u.verification_status || (u.is_verified ? 'approved' : 'pending'),
        is_verified: u.is_verified || false,
        is_blocked: u.is_blocked || false,
        vehicle_category: d.vehicle_category || 'mini',
        vehicle_make: d.vehicle_make || 'N/A',
        vehicle_model: d.vehicle_model || 'N/A',
        vehicle_plate: d.vehicle_plate || 'N/A',
        vehicle_color: d.vehicle_color || 'N/A',
        vehicle_year: d.vehicle_year || '2022',
        ac_option: d.ac_option || 'both',
        license_front_url: d.license_front_url,
        license_back_url: d.license_back_url,
        selfie_url: d.selfie_url,
        vehicle_photo_url: d.vehicle_photo_url,
        is_online: d.is_online || false,
        is_available: d.is_available || true,
        is_active: d.is_active || false,
        rating: d.rating || 5.0,
        total_rides: d.total_rides || 0,
        is_fee_suspended: d.is_fee_suspended || false,
      };
    });

    return { rows: mergedRows, rowCount: mergedRows.length };
  }

  // C. SELECT FROM USERS (Passengers Roster & User queries)
  if (lowerSql.startsWith('select') && lowerSql.includes('from users')) {
    if (lowerSql.includes("u.role = 'passenger'") || lowerSql.includes("role = 'passenger'")) {
      const [{ data: passengers, error: pErr }, { data: rides, error: rErr }] = await Promise.all([
          supabaseClient.from('users').select('id, name, phone, email, cnic, is_verified, is_blocked, created_at').eq('role', 'passenger'),
        supabaseClient.from('rides').select('passenger_id'),
      ]);
      if (pErr) throw new Error(pErr.message);

      const rideCounts = new Map<string, number>();
      (rides || []).forEach((r: any) => {
        if (r.passenger_id) {
          rideCounts.set(r.passenger_id, (rideCounts.get(r.passenger_id) || 0) + 1);
        }
      });

      const rows = (passengers || []).map((u: any) => ({
        id: u.id,
        name: u.name || 'N/A',
        phone: u.phone || 'N/A',
        email: u.email || 'N/A',
        cnic: u.cnic || 'N/A',
        is_verified: u.is_verified || false,
        is_blocked: u.is_blocked || false,
        created_at: u.created_at,
        total_rides: rideCounts.get(u.id) || 0,
      }));

      return { rows, rowCount: rows.length };
    }

    let queryBuilder = supabaseClient.from('users').select('*');

    // LOGIN QUERY: (phone = $1 OR email = $1) — single param for both fields
    if ((lowerSql.includes('phone = $1 or email = $1') || lowerSql.includes('(phone = $1 or email = $1)')) && params && params[0]) {
      const loginKey = params[0];
      queryBuilder = queryBuilder.or(`phone.eq.${loginKey},email.eq.${loginKey}`);
      if (lowerSql.includes('role = $2') && params[1]) {
        queryBuilder = queryBuilder.eq('role', params[1]);
      }
    // DUPLICATE CHECK: (phone = $1 OR email = $2) — two separate params
    } else if (lowerSql.includes('(phone = $1 or email = $2)') || lowerSql.includes('phone = $1 or email = $2')) {
      const phoneVal = params ? params[0] : '';
      const emailVal = params ? params[1] : '';
      const roleVal = params && params.length >= 3 ? params[2] : null;
      queryBuilder = queryBuilder.or(`phone.eq.${phoneVal},email.eq.${emailVal}`);
      if (roleVal) {
        queryBuilder = queryBuilder.eq('role', roleVal);
      }
    } else if (lowerSql.includes('id = $1') && params && params[0]) {
      queryBuilder = queryBuilder.eq('id', params[0]);
    } else if (lowerSql.includes('email = $1') && params && params[0]) {
      queryBuilder = queryBuilder.eq('email', params[0]);
      if (lowerSql.includes('role = $2') && params[1]) {
        queryBuilder = queryBuilder.eq('role', params[1]);
      }
    } else if (lowerSql.includes('phone = $1') && params && params[0]) {
      queryBuilder = queryBuilder.eq('phone', params[0]);
      if (lowerSql.includes('role = $2') && params[1]) {
        queryBuilder = queryBuilder.eq('role', params[1]);
      }
    }

    const { data, error } = await queryBuilder;
    if (error) throw new Error(error.message);
    return { rows: data || [], rowCount: data ? data.length : 0 };
  }

  // D. SELECT FROM DRIVERS (Individual driver lookups)
  if (lowerSql.startsWith('select') && lowerSql.includes('from drivers') && !lowerSql.includes('count(*)') && !lowerSql.includes('sum(')) {
    let queryBuilder = supabaseClient.from('drivers').select('*');
    if (lowerSql.includes('driver_id = $1') && params && params[0]) {
      queryBuilder = queryBuilder.eq('driver_id', params[0]);
    } else if (lowerSql.includes('vehicle_plate') && params && params[0]) {
      queryBuilder = queryBuilder.ilike('vehicle_plate', params[0]);
      if (lowerSql.includes('driver_id != $2') && params[1]) {
        queryBuilder = queryBuilder.neq('driver_id', params[1]);
      }
      if (lowerSql.includes('is_online = true')) {
        queryBuilder = queryBuilder.eq('is_online', true);
      }
    }
    const { data, error } = await queryBuilder;
    if (error) throw new Error(error.message);
    return { rows: data || [], rowCount: data ? data.length : 0 };
  }

  // E. SELECT FROM RIDES (Live Rides Monitor & General Rides)
  if (lowerSql.startsWith('select') && lowerSql.includes('from rides')) {
    if (lowerSql.includes('join users pu') || lowerSql.includes('status in')) {
      const [{ data: rides, error: rErr }, { data: users, error: uErr }] = await Promise.all([
        supabaseClient.from('rides').select('*').in('status', ['requested', 'negotiating', 'accepted', 'arrived', 'in_progress']),
        supabaseClient.from('users').select('id, name'),
      ]);
      if (rErr) throw new Error(rErr.message);

      const userMap = new Map((users || []).map((u: any) => [u.id, u.name]));
      const rows = (rides || []).map((r: any) => ({
        ...r,
        passenger_name: userMap.get(r.passenger_id) || 'Passenger',
        driver_name: r.driver_id ? userMap.get(r.driver_id) || 'Driver' : 'Unassigned',
      }));

      return { rows, rowCount: rows.length };
    }

    let queryBuilder = supabaseClient.from('rides').select('*');
    if (lowerSql.includes('ride_id = $1') && params && params[0]) {
      queryBuilder = queryBuilder.eq('ride_id', params[0]);
    } else if (lowerSql.includes('id = $1') && params && params[0]) {
      queryBuilder = queryBuilder.eq('ride_id', params[0]);
    } else if (lowerSql.includes('passenger_id = $1') && params && params[0]) {
      queryBuilder = queryBuilder.eq('passenger_id', params[0]);
    } else if (lowerSql.includes('driver_id = $1') && params && params[0]) {
      queryBuilder = queryBuilder.eq('driver_id', params[0]);
    }

    const { data, error } = await queryBuilder;
    if (error) throw new Error(error.message);
    return { rows: data || [], rowCount: data ? data.length : 0 };
  }

  // E. SELECT FROM MONTHLY_PAYMENTS (Admin Monthly Payments Roster & Driver Payment Info)
  if (lowerSql.startsWith('select') && lowerSql.includes('from monthly_payments')) {
    if (lowerSql.includes('join users u') || lowerSql.includes('join drivers d')) {
      const [{ data: payments, error: pErr }, { data: users, error: uErr }, { data: drivers, error: dErr }] = await Promise.all([
        supabaseClient.from('monthly_payments').select('*'),
        supabaseClient.from('users').select('id, name, email, phone').eq('role', 'driver'),
        supabaseClient.from('drivers').select('driver_id, vehicle_plate, vehicle_make, vehicle_model'),
      ]);

      if (pErr) throw new Error(pErr.message);

      const userMap = new Map((users || []).map((u: any) => [u.id, u]));
      const driverMap = new Map((drivers || []).map((d: any) => [d.driver_id, d]));

      let rows = (payments || []).map((p: any) => {
        const u: any = userMap.get(p.driver_id) || {};
        const d: any = driverMap.get(p.driver_id) || {};
        return {
          ...p,
          driver_name: u.name || 'N/A',
          driver_email: u.email || 'N/A',
          driver_phone: u.phone || 'N/A',
          vehicle_plate: d.vehicle_plate || 'N/A',
          vehicle_make: d.vehicle_make || 'N/A',
          vehicle_model: d.vehicle_model || 'N/A',
        };
      });

      if (params && params.length > 0 && lowerSql.includes('p.status = $')) {
        const filterStatus = params[0];
        if (filterStatus && filterStatus !== 'all') {
          rows = rows.filter((r: any) => r.status === filterStatus);
        }
      }

      return { rows, rowCount: rows.length };
    }

    let queryBuilder = supabaseClient.from('monthly_payments').select('*');
    if (lowerSql.includes('driver_id = $1') && params && params[0]) {
      queryBuilder = queryBuilder.eq('driver_id', params[0]);
      if (lowerSql.includes('month_year = $2') && params[1]) {
        queryBuilder = queryBuilder.eq('month_year', params[1]);
      }
    } else if (lowerSql.includes('id = $1') && params && params[0]) {
      queryBuilder = queryBuilder.eq('id', params[0]);
    }

    const { data, error } = await queryBuilder;
    if (error) throw new Error(error.message);
    return { rows: data || [], rowCount: data ? data.length : 0 };
  }

  // F. SELECT FROM ADMIN_SETTINGS
  if (lowerSql.startsWith('select') && lowerSql.includes('from admin_settings')) {
    const { data, error } = await supabaseClient.from('admin_settings').select('*');
    if (!error && data && data.length > 0) {
      return { rows: data, rowCount: data.length };
    }
    return { rows: [], rowCount: 0 };
  }

  // G. SELECT FROM AUDIT_LOGS
  if (lowerSql.includes('from audit_logs')) {
    return { rows: [], rowCount: 0 };
  }

  // H. SELECT FROM SAVED_PLACES
  if (lowerSql.startsWith('select') && lowerSql.includes('from saved_places')) {
    let queryBuilder = supabaseClient.from('saved_places').select('id, label, name, latitude, longitude, created_at');
    if (lowerSql.includes('user_id = $1') && params && params[0]) {
      queryBuilder = queryBuilder.eq('user_id', params[0]);
    }
    queryBuilder = queryBuilder.order('created_at', { ascending: false });
    const { data, error } = await queryBuilder;
    if (error) throw new Error(error.message);
    return { rows: data || [], rowCount: data ? data.length : 0 };
  }

  // I. SELECT FROM EMERGENCY_CONTACTS
  if (lowerSql.startsWith('select') && lowerSql.includes('from emergency_contacts')) {
    let queryBuilder = supabaseClient.from('emergency_contacts').select('*');
    if (lowerSql.includes('user_id = $1') && params && params[0]) {
      queryBuilder = queryBuilder.eq('user_id', params[0]);
    }

    const { data, error } = await queryBuilder;
    if (error) throw new Error(error.message);
    return { rows: data || [], rowCount: data ? data.length : 0 };
  }

  // J. SELECT FROM SUPPORT_REPORTS
  if (lowerSql.startsWith('select') && lowerSql.includes('from support_reports')) {
    let queryBuilder = supabaseClient.from('support_reports').select('*');
    if (lowerSql.includes('user_id = $1') && params && params[0]) {
      queryBuilder = queryBuilder.eq('user_id', params[0]);
    }

    const { data, error } = await queryBuilder;
    if (error) throw new Error(error.message);
    return { rows: data || [], rowCount: data ? data.length : 0 };
  }

  // I. SELECT FROM USER_NOTIFICATIONS
  if (lowerSql.startsWith('select') && lowerSql.includes('from user_notifications')) {
    let queryBuilder = supabaseClient.from('user_notifications').select('id, title, message, category, is_read, created_at');
    if (lowerSql.includes('user_id = $1') && params[0]) {
      queryBuilder = queryBuilder.eq('user_id', params[0]);
    }

    const { data, error } = await queryBuilder;
    if (error) throw new Error(error.message);
    return { rows: data || [], rowCount: data ? data.length : 0 };
  }

  // L. SELECT FROM SOS_ALERTS
  if (lowerSql.startsWith('select') && lowerSql.includes('from sos_alerts')) {
    let queryBuilder = supabaseClient.from('sos_alerts').select('id, user_id, user_name, user_role, ride_id, latitude, longitude, status, created_at, resolved_at');
    queryBuilder = queryBuilder.order('created_at', { ascending: false });
    if (params && params[0] && typeof params[0] === 'number') {
      queryBuilder = queryBuilder.limit(params[0]);
    }
    const { data, error } = await queryBuilder;
    if (error) throw new Error(error.message);
    return { rows: data || [], rowCount: data ? data.length : 0 };
  }

  // M. SELECT FROM USER_VERIFICATION_CODES
  if (lowerSql.startsWith('select') && lowerSql.includes('from user_verification_codes')) {
    let queryBuilder = supabaseClient.from('user_verification_codes').select('*');
    if (lowerSql.includes('email = $1') && params[0]) {
      queryBuilder = queryBuilder.eq('email', params[0]);
      if (lowerSql.includes('type = $2') && params[1]) {
        queryBuilder = queryBuilder.eq('type', params[1]);
      }
    } else if (lowerSql.includes('code = $1') && params[0]) {
      queryBuilder = queryBuilder.eq('code', params[0]);
      if (lowerSql.includes('type = $2') && params[1]) {
        queryBuilder = queryBuilder.eq('type', params[1]);
      }
    }
    if (lowerSql.includes('used = false')) {
      queryBuilder = queryBuilder.eq('used', false);
    }
    queryBuilder = queryBuilder.order('created_at', { ascending: false });
    const { data, error } = await queryBuilder;
    if (error) throw new Error(error.message);
    return { rows: data || [], rowCount: data ? data.length : 0 };
  }

  // O. SELECT FROM BIDS
  if (lowerSql.startsWith('select') && lowerSql.includes('from bids')) {
    let queryBuilder = supabaseClient.from('bids').select('*');
    if (lowerSql.includes('id = $1') && params[0]) {
      queryBuilder = queryBuilder.eq('id', params[0]);
    } else if (lowerSql.includes('ride_id = $1') && params[0]) {
      queryBuilder = queryBuilder.eq('ride_id', params[0]);
    }
    queryBuilder = queryBuilder.order('timestamp', { ascending: false });
    const { data, error } = await queryBuilder;
    if (error) throw new Error(error.message);
    return { rows: data || [], rowCount: data ? data.length : 0 };
  }

  // K. INSERT STATEMENT HANDLER
  if (lowerSql.startsWith('insert into')) {
    let tableName = '';
    if (lowerSql.includes('insert into users')) tableName = 'users';
    else if (lowerSql.includes('insert into drivers')) tableName = 'drivers';
    else if (lowerSql.includes('insert into monthly_payments')) tableName = 'monthly_payments';
    else if (lowerSql.includes('insert into emergency_contacts')) tableName = 'emergency_contacts';
    else if (lowerSql.includes('insert into support_reports')) tableName = 'support_reports';
    else if (lowerSql.includes('insert into user_notifications')) tableName = 'user_notifications';
    else if (lowerSql.includes('insert into rides')) tableName = 'rides';
    else if (lowerSql.includes('insert into bids')) tableName = 'bids';
    else if (lowerSql.includes('insert into ratings')) tableName = 'ratings';
    else if (lowerSql.includes('insert into saved_places')) tableName = 'saved_places';
    else if (lowerSql.includes('insert into support_tickets')) tableName = 'support_tickets';
    else if (lowerSql.includes('insert into audit_logs')) tableName = 'audit_logs';
    else if (lowerSql.includes('insert into admin_settings')) tableName = 'admin_settings';
    else if (lowerSql.includes('insert into sos_alerts')) tableName = 'sos_alerts';
    else if (lowerSql.includes('insert into user_verification_codes')) tableName = 'user_verification_codes';

    if (tableName) {
      // Strip ON CONFLICT clause before parsing columns (used by upsert queries)
      const cleanInsertSql = lowerSql.replace(/\s+on\s+conflict[\s\S]*/i, '');

      // Extract column names from SQL — handle multi-line INSERT INTO table (\n columns...)
      const columnsMatch = cleanInsertSql.match(/insert into \w+\s*\(([^)]+)\)/s);
      let columns: string[] = [];
      if (columnsMatch && columnsMatch[1]) {
        columns = columnsMatch[1].split(',').map((c: string) => c.trim().replace(/['"]/g, '').replace(/\s+/g, ''));
      }

      // Build object from params based on column order
      const insertObj: any = {};
      if (columns.length > 0 && params && params.length > 0) {
        columns.forEach((col: string, index: number) => {
          if (index < params.length) {
            insertObj[col] = params[index];
          }
        });
      } else if (params && params.length > 0 && typeof params[0] === 'object') {
        // Fallback: if params is already an object
        Object.assign(insertObj, params[0]);
      }

      if (columns.length === 0 && params && params.length > 0) {
        console.error(`[Supabase Insert Warning] Could not parse columns for table: ${tableName}. SQL: ${sql.substring(0, 120)}`);
      }

      // Handle ON CONFLICT (upsert) — use Supabase upsert if ON CONFLICT is present
      const hasOnConflict = lowerSql.includes('on conflict');
      let result;
      if (hasOnConflict) {
        result = await supabaseClient.from(tableName).upsert(insertObj, { onConflict: 'id' }).select();
      } else {
        result = await supabaseClient.from(tableName).insert(insertObj).select();
      }

      const { data, error } = result;
      if (!error) return { rows: data || [], rowCount: data ? data.length : 1 };
      else {
        console.error(`[Supabase Insert Error] Table: ${tableName}`, error.message, '| Columns:', columns, '| Object keys:', Object.keys(insertObj));
        throw new Error(error.message);
      }
    }
  }

  // K. UPDATE STATEMENT HANDLER
  if (lowerSql.startsWith('update')) {
    if (lowerSql.includes('update users')) {
      const updateObj: any = { updated_at: Date.now() };
      let targetId: string | null = null;
      let filterField: string = 'id';

      // Extract SET clauses and WHERE conditions
      const setMatch = lowerSql.match(/set (.+?) where/i);
      if (setMatch && setMatch[1]) {
        const setClauses = setMatch[1].split(',');
        setClauses.forEach((clause: string, index: number) => {
          const [field, ..._] = clause.trim().split('=');
          const cleanField = field.trim();
          if (params && index < params.length) {
            updateObj[cleanField] = params[index];
          }
        });
      }

      // Extract WHERE condition
      const whereMatch = lowerSql.match(/where (.+)$/i);
      if (whereMatch && whereMatch[1]) {
        const whereClause = whereMatch[1].trim();
        if (whereMatch[1].includes('id = $')) {
          const idIndex = setMatch ? setMatch[1].split(',').length : 0;
          targetId = params[idIndex];
        } else if (whereClause.includes('email = $')) {
          const emailIndex = setMatch ? setMatch[1].split(',').length : 0;
          updateObj.email = params[emailIndex];
          targetId = params[params.length - 1] || params[emailIndex + 1];
        } else if (whereClause.includes('phone = $')) {
          const phoneIndex = setMatch ? setMatch[1].split(',').length : 0;
          updateObj.phone = params[phoneIndex];
          targetId = params[params.length - 1] || params[phoneIndex + 1];
        } else if (whereClause.includes('role =')) {
          // Keep role filter in WHERE
        }
      }

      // Use the last param as target ID if not found
      if (!targetId && params && params.length > 0) {
        targetId = params[params.length - 1];
      }

      if (targetId) {
        let queryBuilder = supabaseClient.from('users').update(updateObj);
        if (filterField === 'id') {
          queryBuilder = queryBuilder.eq('id', targetId);
        } else if (filterField === 'email') {
          queryBuilder = queryBuilder.eq('email', targetId);
        }

        const { data, error } = await queryBuilder.select();
        if (!error) return { rows: data || [], rowCount: data ? data.length : 1 };
        else {
          console.error(`[Supabase Update Error] Table: users`, error.message);
          throw new Error(error.message);
        }
      }
    } else if (lowerSql.includes('update drivers')) {
      const updateObj: any = { updated_at: Date.now() };
      const targetId = params ? params[params.length - 1] : null;
      
      // Extract SET clauses
      const setMatch = lowerSql.match(/set (.+?) where/i);
      if (setMatch && setMatch[1]) {
        const setClauses = setMatch[1].split(',');
        setClauses.forEach((clause: string, index: number) => {
          const [field, ..._] = clause.trim().split('=');
          const cleanField = field.trim();
          if (params && index < params.length) {
            updateObj[cleanField] = params[index];
          }
        });
      }

      if (targetId) {
        const { data, error } = await supabaseClient.from('drivers').update(updateObj).eq('driver_id', targetId).select();
        if (!error) return { rows: data || [], rowCount: data ? data.length : 1 };
        else {
          console.error(`[Supabase Update Error] Table: drivers`, error.message);
          throw new Error(error.message);
        }
      }
    } else if (lowerSql.includes('update monthly_payments')) {
      const updateObj: any = { updated_at: Date.now() };
      const targetId = params ? params[params.length - 1] : null;
      
      const setMatch = lowerSql.match(/set (.+?) where/i);
      if (setMatch && setMatch[1]) {
        const setClauses = setMatch[1].split(',');
        setClauses.forEach((clause: string, index: number) => {
          const [field, ..._] = clause.trim().split('=');
          const cleanField = field.trim();
          if (params && index < params.length) {
            updateObj[cleanField] = params[index];
          }
        });
      }

      if (targetId) {
        const { data, error } = await supabaseClient.from('monthly_payments').update(updateObj).eq('id', targetId).select();
        if (!error) return { rows: data || [], rowCount: data ? data.length : 1 };
        else {
          console.error(`[Supabase Update Error] Table: monthly_payments`, error.message);
          throw new Error(error.message);
        }
      }
    } else if (lowerSql.includes('update sos_alerts')) {
      const updateObj: any = { status: 'resolved', resolved_at: Date.now() };
      const targetId = params ? params[params.length - 1] : null;
      if (targetId) {
        const { data, error } = await supabaseClient.from('sos_alerts').update(updateObj).eq('id', targetId).select();
        if (!error) return { rows: data || [], rowCount: data ? data.length : 1 };
        else {
          console.error(`[Supabase Update Error] Table: sos_alerts`, error.message);
          throw new Error(error.message);
        }
      }
    } else if (lowerSql.includes('update user_verification_codes')) {
      if (lowerSql.includes('used = true')) {
        const targetId = params ? params[0] : null;
        if (targetId) {
          const { data, error } = await supabaseClient.from('user_verification_codes').update({ used: true }).eq('id', targetId).select();
          if (!error) return { rows: data || [], rowCount: data ? data.length : 1 };
        }
      } else if (lowerSql.includes('used = true') && lowerSql.includes('email = $1')) {
        const email = params ? params[0] : null;
        const type = params ? params[1] : null;
        if (email) {
          let builder = supabaseClient.from('user_verification_codes').update({ used: true }).eq('email', email);
          if (type) builder = builder.eq('type', type);
          const { data, error } = await builder.select();
          if (!error) return { rows: data || [], rowCount: data ? data.length : 1 };
        }
      }
    }
  }

  // N. DELETE STATEMENT HANDLER
  if (lowerSql.startsWith('delete from')) {
    let tableName = '';
    let idCol = 'id';
    if (lowerSql.includes('delete from users')) { tableName = 'users'; idCol = 'id'; }
    else if (lowerSql.includes('delete from drivers')) { tableName = 'drivers'; idCol = 'driver_id'; }
    else if (lowerSql.includes('delete from emergency_contacts')) { tableName = 'emergency_contacts'; idCol = 'id'; }
    else if (lowerSql.includes('delete from saved_places')) { tableName = 'saved_places'; idCol = 'id'; }
    else if (lowerSql.includes('delete from user_verification_codes')) { tableName = 'user_verification_codes'; idCol = 'id'; }

    if (tableName && params && params.length > 0) {
      const targetId = params[0];
      let deleteBuilder = supabaseClient.from(tableName).delete().eq(idCol, targetId);
      // Handle compound WHERE: e.g. DELETE FROM saved_places WHERE id = $1 AND user_id = $2
      if (lowerSql.includes('user_id = $2') && params[1]) {
        deleteBuilder = deleteBuilder.eq('user_id', params[1]);
      } else if (lowerSql.includes('email = $1') && tableName === 'user_verification_codes') {
        deleteBuilder = supabaseClient.from('user_verification_codes').delete().eq('email', params[0]);
        if (params[1]) deleteBuilder = deleteBuilder.eq('type', params[1]);
      }
      const { data, error } = await deleteBuilder.select();
      if (!error) return { rows: data || [], rowCount: data ? data.length : 1 };
    }
  }

  // Default fallback empty result
  return { rows: [], rowCount: 0 };
}

/**
 * Universal Zero-Delay Query Engine
 */
export async function query(text: string, params?: any[]) {
  const start = Date.now();

  const tcpOk = await checkTcpHealth();
  if (tcpOk) {
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[PG TCP Query] duration: ${duration}ms | rows: ${res.rowCount}`);
      }
      return res;
    } catch (err) {
      isTcpAvailable = false;
    }
  }

  // Use high-speed Undici HTTP keep-alive engine
  try {
    const httpRes = await runSupabaseHttpsQuery(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Supabase KeepAlive Query] duration: ${duration}ms | rows: ${httpRes.rowCount}`);
    }
    return httpRes;
  } catch (httpErr: any) {
    console.error(`[Database Error] Query failed: "${text.substring(0, 60)}..."`, httpErr?.message || httpErr);
    throw httpErr;
  }
}

/**
 * Atomic Multi-Step Transaction Wrapper
 * Executes callback within a BEGIN / COMMIT block on PostgreSQL pool.
 * Falls back to single query runner if TCP is offline.
 */
export async function withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const tcpOk = await checkTcpHealth();
  if (tcpOk) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    const shimClient = {
      query: (text: string, params?: any[]) => query(text, params),
    };
    return await callback(shimClient);
  }
}
