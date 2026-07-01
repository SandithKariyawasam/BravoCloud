import * as admin from 'firebase-admin';

// Initialize Firebase Admin (assuming default credentials via GOOGLE_APPLICATION_CREDENTIALS or similar in backend)
const serviceAccount = require('../backend/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixStuckDeployments() {
  console.log("Looking for stuck deployments...");
  const deploymentsRef = db.collection('deployments');
  const snapshot = await deploymentsRef.where('status', '==', 'BUILDING').get();
  
  if (snapshot.empty) {
    console.log("No stuck deployments found.");
    return;
  }
  
  let batch = db.batch();
  let count = 0;
  
  snapshot.forEach(doc => {
    console.log(`Marking deployment ${doc.id} as FAILED...`);
    batch.update(doc.ref, { status: 'FAILED' });
    count++;
  });
  
  await batch.commit();
  console.log(`Successfully updated ${count} stuck deployments.`);
}

fixStuckDeployments().catch(console.error);
