import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Initialize Firebase Admin
let serviceAccount: admin.ServiceAccount | null = null;

// Try to load from file first (for local development)
try {
  const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
  serviceAccount = require(serviceAccountPath);
} catch (error) {
  // Fallback to environment variables (for Render)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (projectId && privateKey && clientEmail) {
    serviceAccount = {
      project_id: projectId,
      private_key: privateKey,
      client_email: clientEmail,
    } as admin.ServiceAccount;
  } else {
    console.warn('[Firebase] Firebase Admin credentials not found (set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL). Push notifications will be disabled.');
  }
}

if (serviceAccount && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e: any) {
    console.warn('[Firebase] Firebase Admin app initialization failed:', e?.message);
  }
}

export const fcm = admin.apps.length ? admin.messaging() : (null as any);

