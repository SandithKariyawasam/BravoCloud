import { deployToECS } from './src/lib/aws';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        console.log("Running deployToECS with ALB...");
        const result = await deployToECS("testprojectalbfinal2", "123456.dkr.ecr.us-east-1.amazonaws.com/image:latest", { TEST: "123" });
        console.log("SUCCESS:", result);
    } catch (e) {
        console.error("FAILED:", e);
    }
}
run();
