import { query } from '../config/db';

/**
 * 24-Hour Database Purge Worker
 * Runs periodically to permanently delete rejected driver records past the 24-hour lockout window.
 * This enables drivers to submit a fresh registration after 24 hours without duplicate account collisions.
 */
export async function purgeExpiredRejectedDrivers(): Promise<number> {
  // STRICT USER DIRECTIVE: Never automatically delete any driver or passenger account.
  // Accounts must remain preserved permanently in the database unless explicitly deleted
  // by the user via Delete Account or by an administrator.
  return 0;
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
