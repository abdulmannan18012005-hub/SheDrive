import { fcm } from '../config/firebaseAdmin';
import { query } from '../config/db';

interface SendNotificationParams {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Format data dictionary so all values are strings (required by Firebase Admin FCM data payload)
 */
function sanitizeDataPayload(data: Record<string, any>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      result[key] = typeof value === 'string' ? value : String(value);
    }
  }
  return result;
}

/**
 * Send push notification to a specific user via Firebase Cloud Messaging
 */
export async function sendPushNotification({
  userId,
  title,
  body,
  data = {},
}: SendNotificationParams): Promise<boolean> {
  try {
    if (!fcm) {
      console.log(`[FCM] Push skipped for user ${userId} (FCM not configured)`);
      return false;
    }

    // 1. Fetch user's active FCM token from database
    const result = await query(
      'SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL',
      [userId]
    );

    if (result.rowCount === 0 || !result.rows[0].fcm_token) {
      console.log(`[FCM] No registered device token found for user: ${userId}`);
      return false;
    }

    const fcmToken = result.rows[0].fcm_token;
    const sanitizedData = sanitizeDataPayload({
      ...data,
      title,
      body,
    });

    const notifType = data?.type || '';
    let targetChannel = 'ride_updates';
    if (notifType === 'new_ride_request' || notifType === 'ride_offer') {
      targetChannel = 'ride_requests';
    } else if (notifType === 'chat_message' || notifType === 'chat_notify') {
      targetChannel = 'chat_messages';
    } else if (notifType === 'sos_alert' || notifType === 'emergency') {
      targetChannel = 'safety_alerts';
    }

    // 2. Construct FCM payload optimized for background/minimized/heads-up display
    const message = {
      notification: {
        title,
        body,
      },
      data: sanitizedData,
      token: fcmToken,
      android: {
        priority: 'high' as 'high' | 'normal',
        notification: {
          channelId: targetChannel,
          sound: 'default',
          priority: 'max' as any,
          visibility: 'public' as any, // Shows on lock screen
          defaultVibrateTimings: true,
          defaultSound: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    };

    await fcm.send(message);
    console.log(`[FCM] Notification sent successfully to user ${userId} (${title})`);
    return true;
  } catch (error: any) {
    console.error(`[FCM] Failed to send push notification to user ${userId}:`, error);

    // If token has expired or is invalid, remove from database
    if (
      error.code === 'messaging/registration-token-not-registered' ||
      error.code === 'messaging/invalid-registration-token'
    ) {
      console.log(`[FCM] Removing stale FCM token for user ${userId}`);
      await query('UPDATE users SET fcm_token = NULL WHERE id = $1', [userId]);
    }

    return false;
  }
}

/**
 * Notify all online verified female drivers about a new ride request
 */
export async function notifyNearbyDrivers(
  vehicleCategory: string,
  pickupLabel: string,
  offeredFare: number,
  rideId: string
): Promise<number> {
  try {
    const result = await query(
      `SELECT u.id 
       FROM users u
       JOIN drivers d ON d.user_id = u.id
       WHERE u.role = 'driver'
         AND d.is_online = true
         AND d.verification_status = 'approved'
         AND u.fcm_token IS NOT NULL`
    );

    if (result.rowCount === 0) {
      console.log('[FCM] No online verified drivers available with FCM tokens');
      return 0;
    }

    const title = '🚗 New Ride Request Nearby';
    const body = `Pickup: ${pickupLabel.substring(0, 35)} • Offer: Rs. ${offeredFare}`;
    const data = {
      type: 'new_ride_request',
      rideId,
      vehicleCategory,
    };

    let sentCount = 0;
    for (const row of result.rows) {
      const sent = await sendPushNotification({
        userId: row.id,
        title,
        body,
        data,
      });
      if (sent) sentCount++;
    }

    console.log(`[FCM] Dispatched new ride request push alert to ${sentCount} online drivers`);
    return sentCount;
  } catch (err) {
    console.error('[FCM] Error notifying nearby drivers:', err);
    return 0;
  }
}

/**
 * Send bulk push notifications
 */
export async function sendBulkNotification(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<number> {
  let successCount = 0;

  for (const userId of userIds) {
    const success = await sendPushNotification({ userId, title, body, data });
    if (success) successCount++;
  }

  return successCount;
}
