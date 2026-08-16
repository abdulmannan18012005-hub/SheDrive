import { fcm } from '../config/firebaseAdmin';
import { query } from '../config/db';

interface SendNotificationParams {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Send push notification to a specific user
 */
export async function sendPushNotification({
  userId,
  title,
  body,
  data = {},
}: SendNotificationParams): Promise<boolean> {
  try {
    // Get user's FCM token from database
    const result = await query(
      'SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL',
      [userId]
    );

    if (result.rowCount === 0) {
      console.log('No FCM token found for user:', userId);
      return false;
    }

    const fcmToken = result.rows[0].fcm_token;

    // Send notification
    const message = {
      notification: {
        title,
        body,
      },
      data,
      token: fcmToken,
      android: {
        priority: 'high' as 'high' | 'normal',
        notification: {
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    };

    await fcm.send(message);
    console.log('Notification sent successfully to user:', userId);
    return true;
  } catch (error: any) {
    console.error('Failed to send notification:', error);
    
    // If token is invalid, remove it from database
    if (error.code === 'messaging/registration-token-not-registered') {
      await query(
        'UPDATE users SET fcm_token = NULL WHERE id = $1',
        [userId]
      );
    }
    
    return false;
  }
}

/**
 * Send notification to multiple users
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
