import { deployToECS } from './src/lib/aws';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        console.log("Testing deployToECS...");
        const url = await deployToECS("testproject", "123456789012.dkr.ecr.us-east-1.amazonaws.com/test:latest", {});
        console.log("Success! URL:", url);
    } catch (e) {
        console.error("Test failed:", e);
    }
}
test();
