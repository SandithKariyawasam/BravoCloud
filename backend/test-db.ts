import { db } from './src/lib/firebase';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const snapshot = await db.collection('projects').get();
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`Project: ${data.name}, Subdomain: ${data.subdomain}`);
        });
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
