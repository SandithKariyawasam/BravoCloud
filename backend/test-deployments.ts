import { db } from './src/lib/firebase';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const snapshot = await db.collection('deployments').orderBy('createdAt', 'desc').limit(5).get();
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`Deploy: ${doc.id}, Status: ${data.status}, Time: ${data.createdAt}`);
        });
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
