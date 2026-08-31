import { query } from '../config/db';

/**
 * 24-Hour Database Purge Worker
 * Runs periodically to permanently delete rejected driver records past the 24-hour lockout window.
 * This enables drivers to submit a fresh registration after 24 hours without duplicate account collisions.
 */
export async function purgeExpiredRejectedDrivers(): Promise<number> {
  try {
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

    // Find all driver accounts rejected more than 24 hours ago
    const rejectedRes = await query(
      `SELECT id, email, phone 
       FROM users 
       WHERE role = 'driver' 
         AND verification_status = 'rejected' 
         AND (rejection_timestamp IS NOT NULL AND rejection_timestamp <= $1)`,
      [twentyFourHoursAgo]
    );

    if (!rejectedRes || rejectedRes.rows.length === 0) {
      return 0;
    }

    const expiredIds = rejectedRes.rows.map((r: any) => r.id);
    console.log(`[24H DRIVER CLEANUP] Found ${expiredIds.length} rejected driver accounts past 24-hour cooldown. Purging...`);

    let purgedCount = 0;
    for (const userId of expiredIds) {
      try {
        await query('DELETE FROM drivers WHERE driver_id = $1', [userId]);
        await query('DELETE FROM user_notifications WHERE user_id = $1', [userId]);
        await query('DELETE FROM emergency_contacts WHERE user_id = $1', [userId]);
        await query('DELETE FROM users WHERE id = $1', [userId]);
        purgedCount++;
      } catch (err: any) {
        console.warn(`[24H DRIVER CLEANUP] Warning purging user ID ${userId}:`, err?.message || err);
      }
    }

    console.log(`[24H DRIVER CLEANUP] Successfully purged ${purgedCount} rejected driver accounts.`);
    return purgedCount;
  } catch (error: any) {
    console.error('[24H DRIVER CLEANUP] Error executing auto-purge worker:', error?.message || error);
    return 0;
  }
}

/**
 * Start the periodic cron worker
 */
export function startCleanupCron(intervalMs: number = 30 * 60 * 1000): NodeJS.Timeout {
  // Run once on startup after 10 seconds
  setTimeout(() => {
    purgeExpiredRejectedDrivers().catch(() => {});
  }, 10000);

  const timer = setInterval(() => {
    purgeExpiredRejectedDrivers().catch(() => {});
  }, intervalMs);

  if (timer.unref) {
    timer.unref();
  }

  console.log(`[24H DRIVER CLEANUP] Background cleanup worker initialized (running every ${intervalMs / 60000} minutes).`);
  return timer;
}
