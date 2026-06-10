import { ECSClient, ListTasksCommand, DescribeTasksCommand } from "@aws-sdk/client-ecs";
import { EC2Client, DescribeNetworkInterfacesCommand } from "@aws-sdk/client-ec2";
import { db } from './src/lib/firebase';
import * as dotenv from 'dotenv';
dotenv.config();

const region = process.env.AWS_REGION || "us-east-1";
const ecsClient = new ECSClient({ region });
const ec2Client = new EC2Client({ region });

async function syncIp() {
    try {
        console.log("Fetching project from DB...");
        const snapshot = await db.collection('projects').limit(1).get();
        if (snapshot.empty) {
            console.log("No projects found.");
            return;
        }
        const doc = snapshot.docs[0];
        const project = doc.data();
        console.log("Project:", project.name);

        const sanitizedName = project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const clusterName = "bravocloud-cluster";
        const serviceName = `bravocloud-service-${sanitizedName}`;

        console.log(`Listing tasks for service: ${serviceName}...`);
        const listRes = await ecsClient.send(new ListTasksCommand({
            cluster: clusterName,
            serviceName: serviceName
        }));

        if (!listRes.taskArns || listRes.taskArns.length === 0) {
            console.log("No tasks running for this service.");
            return;
        }

        const taskArn = listRes.taskArns[0];
        console.log("Found task:", taskArn);

        const descRes = await ecsClient.send(new DescribeTasksCommand({
            cluster: clusterName,
            tasks: [taskArn]
        }));

        const task = descRes.tasks?.[0];
        const eniDetail = task?.attachments?.[0]?.details?.find(d => d.name === "networkInterfaceId");
        
        if (!eniDetail?.value) {
            console.log("Task does not have an ENI assigned yet.");
            return;
        }

        const eniId = eniDetail.value;
        console.log("Found ENI:", eniId);

        const eniRes = await ec2Client.send(new DescribeNetworkInterfacesCommand({
            NetworkInterfaceIds: [eniId]
        }));

        const publicIp = eniRes.NetworkInterfaces?.[0]?.Association?.PublicIp;
        
        if (!publicIp) {
            console.log("ENI does not have a public IP.");
            return;
        }

        console.log("Public IP extracted:", publicIp);
        const finalUrl = `${publicIp}:3000`;

        console.log(`Updating Firestore subdomain to: ${finalUrl}`);
        await doc.ref.update({ subdomain: finalUrl });
        console.log("Successfully synced IP to database!");

    } catch (e) {
        console.error("Error syncing IP:", e);
    }
}

syncIp();
