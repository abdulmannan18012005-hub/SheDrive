const fs = require('fs');
let dm = fs.readFileSync('src/services/driverMatcher.ts', 'utf8');
dm = dm.replace(
  'const lat = driver.location?.latitude || driver.latitude;',
  'const lat = driver.latitude;'
).replace(
  'const lng = driver.location?.longitude || driver.longitude;',
  'const lng = driver.longitude;'
);
fs.writeFileSync('src/services/driverMatcher.ts', dm);
console.log('Fixed driverMatcher.ts');
