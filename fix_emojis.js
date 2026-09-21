const fs = require('fs');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  content = content.replace(/ðŸ‘©/g, '👩');
  content = content.replace(/ðŸš—/g, '🚗');
  content = content.replace(/ðŸš~/g, '🚗');
  content = content.replace(/ðŸ“±/g, '📱');
  content = content.replace(/ðŸ”’/g, '🔒');
  content = content.replace(/ðŸ™ˆ/g, '🙈');
  content = content.replace(/ðŸ‘ ï¸ /g, '👁️');
  content = content.replace(/ðŸ‘ /g, '👁️');
  content = content.replace(/ðŸ“…/g, '📅');
  content = content.replace(/ðŸ›µ/g, '🛵');
  content = content.replace(/ðŸ ƒ/g, '🍃');
  content = content.replace(/â „ï¸ /g, '❄️');
  content = content.replace(/ðŸ“„/g, '📄');
  content = content.replace(/ðŸ“·/g, '📷');
  content = content.replace(/ðŸ†”/g, '🆔');
  content = content.replace(/âœ…/g, '✅');
  content = content.replace(/ï¸ /g, ''); // Remove trailing variation selectors if orphaned

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed:', filePath);
  }
}

const files = [
  'src/screens/auth/RegisterScreen.tsx',
  'src/screens/auth/LoginScreen.tsx',
  'src/screens/passenger/ProfileScreen.tsx',
  'src/screens/passenger/EditProfileScreen.tsx',
  'src/screens/driver/ProfileScreen.tsx',
  'src/screens/driver/EditProfileScreen.tsx',
  'src/screens/driver/ActiveRideScreen.tsx',
  'src/screens/passenger/RideTrackingScreen.tsx',
  'server/src/routes/v1/ride.routes.ts',
  'server/src/routes/v1/admin.routes.ts'
];

for (const file of files) {
  try {
    fixFile(file);
  } catch (e) {
    // console.error(e);
  }
}
