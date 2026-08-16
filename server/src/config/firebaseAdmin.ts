import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Initialize Firebase Admin
let serviceAccount: admin.ServiceAccount;

// Try to load from file first (for local development)
try {
  const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
  serviceAccount = require(serviceAccountPath);
} catch (error) {
  // Fallback to environment variables (for Render)
  serviceAccount = {
    project_id: process.env.FIREBASE_PROJECT_ID || 'lahore-pink-rides',
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
  } as admin.ServiceAccount;
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const fcm = admin.messaging();
