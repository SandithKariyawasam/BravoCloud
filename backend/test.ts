import dotenv from 'dotenv';
dotenv.config();

import { db } from './src/lib/firebase';
import crypto from 'crypto';

async function test() {
  try {
    const token = 'bc_1234';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokensQuery = await db.collectionGroup('tokens').where('hash', '==', tokenHash).limit(1).get();
    console.log("Empty?", tokensQuery.empty);
  } catch (e) {
    console.error("ERROR:", e);
  }
  process.exit(0);
}
test();
