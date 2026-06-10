import { ElasticLoadBalancingV2Client, DescribeTargetHealthCommand, DescribeTargetGroupsCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
import * as dotenv from 'dotenv';
dotenv.config();

const elbClient = new ElasticLoadBalancingV2Client({ region: "us-east-1" });

async function run() {
    try {
        const descRes = await elbClient.send(new DescribeTargetGroupsCommand({ Names: ["bravocloud-tg-bravocloud"] }));
        const tgArn = descRes.TargetGroups?.[0]?.TargetGroupArn;
        console.log("TG ARN:", tgArn);
        if (tgArn) {
            const health = await elbClient.send(new DescribeTargetHealthCommand({ TargetGroupArn: tgArn }));
            console.log("Target Health Descriptions:", health.TargetHealthDescriptions);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
