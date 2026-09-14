const fs = require('fs');

let rs = fs.readFileSync('src/screens/auth/RegisterScreen.tsx', 'utf8');
rs = rs.replace(
  'const [licenseBackUri, setLicenseBackUri] = useState<string | null>(null);',
  'const [licenseBackUri, setLicenseBackUri] = useState<string | null>(null);\n  const [registrationUri, setRegistrationUri] = useState<string | null>(null);\n  const [insuranceUri, setInsuranceUri] = useState<string | null>(null);'
);
fs.writeFileSync('src/screens/auth/RegisterScreen.tsx', rs);

let dm = fs.readFileSync('src/services/driverMatcher.ts', 'utf8');
dm = dm.replace(
  /driver\.location\.latitude/g,
  'driver.latitude'
).replace(
  /driver\.location\.longitude/g,
  'driver.longitude'
);
fs.writeFileSync('src/services/driverMatcher.ts', dm);

console.log('Fixed TS errors');
