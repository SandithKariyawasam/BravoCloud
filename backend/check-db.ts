import { db } from './src/lib/firebase';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkProject() {
    try {
        const snapshot = await db.collection('projects').limit(1).get();
        if (snapshot.empty) {
            console.log("No projects found.");
            return;
        }
        const doc = snapshot.docs[0];
        console.log("Project:", doc.id);
        console.log("Subdomain:", doc.data().subdomain);
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}
checkProject();
