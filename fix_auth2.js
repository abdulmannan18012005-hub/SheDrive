const fs = require('fs');
let content = fs.readFileSync('server/src/routes/v1/auth.routes.ts', 'utf8');

// 1. Import adminAuth
content = content.replace(
  'import { supabase } from \'../../config/supabase\';',
  'import { supabase } from \'../../config/supabase\';\nimport { adminAuth } from \'../../config/firebaseAdmin\';'
);

// 2. Fix processDocumentUpload
content = content.replace(
  /async function processDocumentUpload[\s\S]*?return trimmed;\n}/m,
  'async function processDocumentUpload(imageUriOrBase64?: string, folder: string = \'shedrive/documents\'): Promise<string | null> {\n' +
  '  if (!imageUriOrBase64 || typeof imageUriOrBase64 !== \'string\') return null;\n' +
  '  const trimmed = imageUriOrBase64.trim();\n' +
  '  if (!trimmed) return null;\n' +
  '  if (trimmed.startsWith(\'http://\') || trimmed.startsWith(\'https://\')) return trimmed;\n' +
  '  if (trimmed.startsWith(\'data:image/\') || trimmed.length > 500) {\n' +
  '    try {\n' +
  '      const uploadRes = await uploadImage(trimmed, folder);\n' +
  '      return uploadRes.url;\n' +
  '    } catch (err: any) {\n' +
  '      console.warn(\'Cloudinary warning for \' + folder + \':\', err?.message || err);\n' +
  '      return null;\n' +
  '    }\n' +
  '  }\n' +
  '  return null;\n' +
  '}'
);

// 3. Fix saveVerificationCode
content = content.replace(
  /await saveVerificationCode\(cleanEmail, token, firebaseCustomToken, `password_reset:\$\{role\}`,\s*expiresAt\);/g,
  'await saveVerificationCode(cleanEmail, token, `password_reset:${role}`, expiresAt);'
);

// 4. Fix redeclarations
content = content.replace(
  /let firebaseCustomToken = null;\n\s*try \{ if \(adminAuth\) firebaseCustomToken = await adminAuth\.createCustomToken\(user\.id\); \} catch \(e\) \{\}/g,
  'let newFbToken = null;\n    try { if (adminAuth) newFbToken = await adminAuth.createCustomToken(user.id); } catch (e) {}'
);

content = content.replace(
  /token: authToken,\s*firebaseCustomToken,/g,
  'token: authToken,\n        firebaseCustomToken: newFbToken,'
);

fs.writeFileSync('server/src/routes/v1/auth.routes.ts', content);
console.log('Fixed');
