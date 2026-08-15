const { Client } = require('pg');
require('dotenv').config();

const connectionCandidates = [
  process.env.DATABASE_URL,
  process.env.DATABASE_URL?.replace(':5432/', ':6543/'),
  'postgresql://postgres:H18a01m%402003@db.bulntofrddglxyxhtykf.supabase.co:5432/postgres',
  'postgresql://postgres.bulntofrddglxyxhtykf:H18a01m%402003@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
];

async function verifyAndMigrate() {
  let client = null;
  let connectedConnStr = null;

  for (const connStr of connectionCandidates) {
    if (!connStr) continue;
    try {
      console.log(`Trying connection to: ${connStr.replace(/:[^:@]+@/, ':****@')}`);
      const testClient = new Client({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
      });
      await testClient.connect();
      console.log('✅ Connected successfully!');
      client = testClient;
      connectedConnStr = connStr;
      break;
    } catch (err) {
      console.warn(`❌ Connection failed (${err.code || err.message})`);
    }
  }

  if (!client) {
    console.error('All connection candidates failed. Please check network/Supabase host status.');
    process.exit(1);
  }

  try {
    // Helper to check table existence
    const tableExists = async (tableName) => {
      const res = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
      );
      return res.rows.length > 0;
    };

    // Helper to check column existence
    const columnExists = async (tableName, columnName) => {
      const res = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [tableName, columnName]
      );
      return res.rows.length > 0;
    };

    console.log('\n================ DATABASE SCHEMA VERIFICATION ================');

    // 1. vehicle_photo_url
    let hasVehiclePhoto = await columnExists('drivers', 'vehicle_photo_url');
    console.log(`1. drivers.vehicle_photo_url: ${hasVehiclePhoto ? '✅ EXISTS' : '❌ MISSING'}`);
    if (!hasVehiclePhoto) {
      console.log('   Applying migration for drivers.vehicle_photo_url...');
      await client.query('ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_photo_url TEXT;');
      hasVehiclePhoto = await columnExists('drivers', 'vehicle_photo_url');
      console.log(`   Result: ${hasVehiclePhoto ? '✅ FIXED' : '❌ FAILED'}`);
    }

    // 2. is_fee_suspended
    let hasFeeSuspended = await columnExists('drivers', 'is_fee_suspended');
    console.log(`2. drivers.is_fee_suspended: ${hasFeeSuspended ? '✅ EXISTS' : '❌ MISSING'}`);
    if (!hasFeeSuspended) {
      console.log('   Applying migration for drivers.is_fee_suspended...');
      await client.query('ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_fee_suspended BOOLEAN DEFAULT FALSE;');
      hasFeeSuspended = await columnExists('drivers', 'is_fee_suspended');
      console.log(`   Result: ${hasFeeSuspended ? '✅ FIXED' : '❌ FAILED'}`);
    }

    // 3. ac_option
    let hasAcOption = await columnExists('drivers', 'ac_option');
    console.log(`3. drivers.ac_option: ${hasAcOption ? '✅ EXISTS' : '❌ MISSING'}`);
    if (!hasAcOption) {
      console.log('   Applying migration for drivers.ac_option...');
      await client.query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS ac_option VARCHAR(20) DEFAULT 'both';");
      hasAcOption = await columnExists('drivers', 'ac_option');
      console.log(`   Result: ${hasAcOption ? '✅ FIXED' : '❌ FAILED'}`);
    }

    // 4. monthly_payments table
    let hasMonthlyPayments = await tableExists('monthly_payments');
    console.log(`4. monthly_payments table: ${hasMonthlyPayments ? '✅ EXISTS' : '❌ MISSING'}`);
    if (!hasMonthlyPayments) {
      console.log('   Applying migration for monthly_payments table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS monthly_payments (
          id VARCHAR(64) PRIMARY KEY,
          driver_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          month_year VARCHAR(7) NOT NULL,
          total_rides INTEGER DEFAULT 0,
          total_earnings NUMERIC(10, 2) DEFAULT 0.00,
          platform_fee NUMERIC(10, 2) DEFAULT 0.00,
          due_date BIGINT NOT NULL,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'paid', 'overdue', 'rejected')),
          transaction_id VARCHAR(100),
          receipt_url TEXT,
          notes TEXT,
          admin_notes TEXT,
          submitted_at BIGINT,
          reviewed_at BIGINT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          CONSTRAINT unique_driver_month UNIQUE(driver_id, month_year)
        );
      `);
      hasMonthlyPayments = await tableExists('monthly_payments');
      console.log(`   Result: ${hasMonthlyPayments ? '✅ FIXED' : '❌ FAILED'}`);
    }

    // 5. Phase 3 tables & columns
    let hasEmergencyContacts = await tableExists('emergency_contacts');
    let hasSupportReports = await tableExists('support_reports');
    let hasUserNotifications = await tableExists('user_notifications');
    let hasUsersIsActive = await columnExists('users', 'is_active');
    let hasFeeTermsAccepted = await columnExists('drivers', 'fee_terms_accepted');

    console.log(`5. Phase 3 items:`);
    console.log(`   - emergency_contacts table: ${hasEmergencyContacts ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   - support_reports table: ${hasSupportReports ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   - user_notifications table: ${hasUserNotifications ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   - users.is_active column: ${hasUsersIsActive ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   - drivers.fee_terms_accepted column: ${hasFeeTermsAccepted ? '✅ EXISTS' : '❌ MISSING'}`);

    if (!hasEmergencyContacts || !hasSupportReports || !hasUserNotifications || !hasUsersIsActive || !hasFeeTermsAccepted) {
      console.log('   Applying Phase 3 schema migration...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS emergency_contacts (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          relationship VARCHAR(100) NOT NULL,
          phone VARCHAR(50) NOT NULL,
          created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS support_reports (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id),
          user_role VARCHAR(20) NOT NULL,
          title VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          description TEXT NOT NULL,
          screenshot_url TEXT,
          status VARCHAR(20) DEFAULT 'open',
          created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_notifications (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          category VARCHAR(50) DEFAULT 'system',
          is_read BOOLEAN DEFAULT FALSE,
          created_at BIGINT NOT NULL
        );

        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at BIGINT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS language_preference VARCHAR(10) DEFAULT 'en';

        ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_expiry BIGINT;
        ALTER TABLE drivers ADD COLUMN IF NOT EXISTS registration_expiry BIGINT;
        ALTER TABLE drivers ADD COLUMN IF NOT EXISTS fee_terms_accepted BOOLEAN DEFAULT TRUE;
        ALTER TABLE drivers ADD COLUMN IF NOT EXISTS fee_terms_accepted_at BIGINT;
      `);
      console.log('   Phase 3 schema migration executed.');
    }

    console.log('\n================ FINAL VERIFICATION ================');
    const finalVehiclePhoto = await columnExists('drivers', 'vehicle_photo_url');
    const finalFeeSuspended = await columnExists('drivers', 'is_fee_suspended');
    const finalAcOption = await columnExists('drivers', 'ac_option');
    const finalMonthlyPayments = await tableExists('monthly_payments');
    const finalEmergencyContacts = await tableExists('emergency_contacts');
    const finalSupportReports = await tableExists('support_reports');
    const finalUserNotifications = await tableExists('user_notifications');

    const allReady =
      finalVehiclePhoto &&
      finalFeeSuspended &&
      finalAcOption &&
      finalMonthlyPayments &&
      finalEmergencyContacts &&
      finalSupportReports &&
      finalUserNotifications;

    console.log(`vehicle_photo_url: ${finalVehiclePhoto ? 'OK' : 'FAIL'}`);
    console.log(`is_fee_suspended: ${finalFeeSuspended ? 'OK' : 'FAIL'}`);
    console.log(`ac_option: ${finalAcOption ? 'OK' : 'FAIL'}`);
    console.log(`monthly_payments: ${finalMonthlyPayments ? 'OK' : 'FAIL'}`);
    console.log(`emergency_contacts: ${finalEmergencyContacts ? 'OK' : 'FAIL'}`);
    console.log(`support_reports: ${finalSupportReports ? 'OK' : 'FAIL'}`);
    console.log(`user_notifications: ${finalUserNotifications ? 'OK' : 'FAIL'}`);
    console.log(`\nALL MIGRATIONS READY: ${allReady ? 'YES ✅' : 'NO ❌'}`);
    console.log(`RECOMMENDED DATABASE_URL: ${connectedConnStr}`);

  } catch (err) {
    console.error('Error during schema verification:', err);
  } finally {
    await client.end();
  }
}

verifyAndMigrate();
