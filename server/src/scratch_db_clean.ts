import { query, pool } from './config/db';

async function cleanRuntimeData() {
  try {
    console.log('[DB Clean] Starting runtime test data cleanup...');
    await query('DELETE FROM ratings');
    await query('DELETE FROM bids');
    await query('DELETE FROM complaints');
    await query('DELETE FROM support_tickets');
    await query('DELETE FROM saved_places');
    await query('DELETE FROM audit_logs');
    await query('DELETE FROM rides');
    await query('DELETE FROM drivers');
    await query("DELETE FROM users WHERE role != 'admin'");
    console.log('[DB Clean] Successfully deleted all runtime testing data! Schema and tables preserved.');
  } catch (err) {
    console.error('[DB Clean Error]', err);
  } finally {
    await pool.end();
  }
}

cleanRuntimeData();
