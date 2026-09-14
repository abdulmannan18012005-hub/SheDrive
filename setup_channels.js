const fs = require('fs');
let content = fs.readFileSync('src/services/notificationService.ts', 'utf8');

if (!content.includes('import * as Notifications')) {
  content = content.replace(
    'import messaging from \'@react-native-firebase/messaging\';',
    'import messaging from \'@react-native-firebase/messaging\';\nimport * as Notifications from \'expo-notifications\';'
  );

  const initChannelsCode = `
export async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('ride_alerts', {
      name: 'Ride Alerts',
      description: 'Notifications for ride updates, bids, and driver arrivals',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    
    await Notifications.setNotificationChannelAsync('admin_broadcasts', {
      name: 'Platform Broadcasts',
      description: 'Platform news, community updates, and announcements',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    
    await Notifications.setNotificationChannelAsync('chatMessages', {
      name: 'Chat Messages',
      description: 'Notifications for in-ride chat messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    
    await Notifications.setNotificationChannelAsync('safetyAlerts', {
      name: 'Safety Alerts',
      description: 'Emergency SOS and safety notifications',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#FF0000',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}
`;

  content = content.replace(
    'export function initializeNotificationListeners',
    initChannelsCode + '\nexport function initializeNotificationListeners'
  );

  content = content.replace(
    'const messagingInst = getMessagingInstance();',
    'setupNotificationChannels();\n  const messagingInst = getMessagingInstance();'
  );

  fs.writeFileSync('src/services/notificationService.ts', content);
  console.log('Channels configured successfully');
} else {
  console.log('Channels already configured');
}
