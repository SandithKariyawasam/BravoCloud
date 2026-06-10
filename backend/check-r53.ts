import { Route53Client, ListHostedZonesByNameCommand } from "@aws-sdk/client-route-53";
import * as dotenv from 'dotenv';
dotenv.config();

const r53 = new Route53Client({ region: process.env.AWS_REGION || 'us-east-1' });

async function checkZone() {
    try {
        const res = await r53.send(new ListHostedZonesByNameCommand({ DNSName: "bravocloud.tech" }));
        if (res.HostedZones && res.HostedZones.length > 0) {
            console.log("Found zones:", res.HostedZones.map(z => z.Name));
        } else {
            console.log("No hosted zones found for bravocloud.tech");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

checkZone();
