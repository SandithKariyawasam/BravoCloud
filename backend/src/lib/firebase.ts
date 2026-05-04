import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    console.log('✅ Firebase Admin initialized successfully.');
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error);
    console.warn('⚠️ Make sure you have set the GOOGLE_APPLICATION_CREDENTIALS environment variable in your .env file pointing to your service account JSON file.');
  }
}

export const db = admin.firestore();
export const auth = admin.auth();
