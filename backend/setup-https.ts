import { ACMClient, RequestCertificateCommand, DescribeCertificateCommand } from "@aws-sdk/client-acm";
import { ElasticLoadBalancingV2Client, CreateLoadBalancerCommand, CreateListenerCommand, CreateTargetGroupCommand, DescribeLoadBalancersCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
import { EC2Client, DescribeVpcsCommand, DescribeSubnetsCommand, CreateSecurityGroupCommand, AuthorizeSecurityGroupIngressCommand } from "@aws-sdk/client-ec2";
import * as dotenv from 'dotenv';
dotenv.config();

const region = process.env.AWS_REGION || "us-east-1";
const acmClient = new ACMClient({ region });
const elbClient = new ElasticLoadBalancingV2Client({ region });
const ec2Client = new EC2Client({ region });

const domainName = "bravocloud.tech";

async function setup() {
    console.log("🚀 Starting BravoCloud HTTPS Infrastructure Setup...\n");

    try {
        // 1. Request ACM Certificate
        console.log(`1️⃣ Requesting SSL Certificate for *.${domainName} and ${domainName}...`);
        const reqCertRes = await acmClient.send(new RequestCertificateCommand({
            DomainName: domainName,
            SubjectAlternativeNames: [`*.${domainName}`],
            ValidationMethod: "DNS"
        }));

        const certArn = reqCertRes.CertificateArn;
        if (!certArn) throw new Error("Failed to request certificate");
        
        console.log("Certificate ARN:", certArn);
        console.log("⏳ Waiting 10 seconds for AWS to generate DNS validation records...\n");
        await new Promise(r => setTimeout(r, 10000));

        // 2. Get DNS Validation Records
        let certDesc;
        for (let i = 0; i < 5; i++) {
            const descRes = await acmClient.send(new DescribeCertificateCommand({ CertificateArn: certArn }));
            certDesc = descRes.Certificate;
            if (certDesc?.DomainValidationOptions && certDesc.DomainValidationOptions[0].ResourceRecord) {
                break;
            }
            await new Promise(r => setTimeout(r, 3000));
        }

        const validationRecords = certDesc?.DomainValidationOptions || [];
        
        console.log("==========================================================");
        console.log("🚨 ACTION REQUIRED: Add these CNAME records to your DNS registrar (e.g. Namecheap, GoDaddy):");
        const uniqueRecords = new Set();
        validationRecords.forEach(opt => {
            const record = opt.ResourceRecord;
            if (record && !uniqueRecords.has(record.Name)) {
                uniqueRecords.add(record.Name);
                console.log(`\nType: CNAME`);
                console.log(`Name/Host: ${record.Name}`);
                console.log(`Value/Target: ${record.Value}`);
            }
        });
        console.log("==========================================================\n");

        console.log("⏳ Waiting for DNS Validation... (This can take anywhere from 5 to 30 minutes)");
        console.log("DO NOT KILL THIS SCRIPT! It will automatically continue once AWS validates the records.\n");

        // Poll for Validation
        let isIssued = false;
        while (!isIssued) {
            const check = await acmClient.send(new DescribeCertificateCommand({ CertificateArn: certArn }));
            if (check.Certificate?.Status === "ISSUED") {
                isIssued = true;
                console.log("✅ SSL Certificate successfully issued!");
            } else if (check.Certificate?.Status === "FAILED" || check.Certificate?.Status === "VALIDATION_TIMED_OUT") {
                throw new Error("Certificate validation failed or timed out.");
            } else {
                process.stdout.write(".");
                await new Promise(r => setTimeout(r, 15000));
            }
        }

        // 3. Create ALB Infrastructure
        console.log("\n2️⃣ Provisioning Application Load Balancer...");

        const vpcRes = await ec2Client.send(new DescribeVpcsCommand({ Filters: [{ Name: "isDefault", Values: ["true"] }] }));
        const vpcId = vpcRes.Vpcs?.[0]?.VpcId;
        if (!vpcId) throw new Error("No default VPC found");

        const subnetsRes = await ec2Client.send(new DescribeSubnetsCommand({ Filters: [{ Name: "vpc-id", Values: [vpcId] }] }));
        const subnetIds = subnetsRes.Subnets?.slice(0, 2).map(s => s.SubnetId as string) || [];
        if (subnetIds.length < 2) throw new Error("At least 2 subnets are required for ALB");

        // Create SG for ALB
        const sgRes = await ec2Client.send(new CreateSecurityGroupCommand({
            GroupName: "bravocloud-alb-sg",
            Description: "Security Group for BravoCloud ALB",
            VpcId: vpcId
        }));
        const albSgId = sgRes.GroupId;

        await ec2Client.send(new AuthorizeSecurityGroupIngressCommand({
            GroupId: albSgId,
            IpPermissions: [
                { IpProtocol: "tcp", FromPort: 80, ToPort: 80, IpRanges: [{ CidrIp: "0.0.0.0/0" }] },
                { IpProtocol: "tcp", FromPort: 443, ToPort: 443, IpRanges: [{ CidrIp: "0.0.0.0/0" }] }
            ]
        }));
        console.log(`✅ Created ALB Security Group: ${albSgId}`);

        // Create ALB
        const albRes = await elbClient.send(new CreateLoadBalancerCommand({
            Name: "bravocloud-alb",
            Subnets: subnetIds,
            SecurityGroups: [albSgId as string],
            Scheme: "internet-facing",
            Type: "application"
        }));
        const albArn = albRes.LoadBalancers?.[0]?.LoadBalancerArn;
        const albDns = albRes.LoadBalancers?.[0]?.DNSName;
        console.log(`✅ Created Application Load Balancer: ${albDns}`);

        // Create Dummy Default Target Group
        const tgRes = await elbClient.send(new CreateTargetGroupCommand({
            Name: "bravocloud-default-tg",
            Protocol: "HTTP",
            Port: 80,
            VpcId: vpcId,
            TargetType: "ip"
        }));
        const defaultTgArn = tgRes.TargetGroups?.[0]?.TargetGroupArn;

        // Create HTTPS Listener
        await elbClient.send(new CreateListenerCommand({
            LoadBalancerArn: albArn,
            Protocol: "HTTPS",
            Port: 443,
            Certificates: [{ CertificateArn: certArn }],
            DefaultActions: [{ Type: "forward", TargetGroupArn: defaultTgArn }]
        }));
        console.log(`✅ Created HTTPS Listener on port 443`);

        // Create HTTP to HTTPS redirect listener
        await elbClient.send(new CreateListenerCommand({
            LoadBalancerArn: albArn,
            Protocol: "HTTP",
            Port: 80,
            DefaultActions: [{
                Type: "redirect",
                RedirectConfig: { Protocol: "HTTPS", Port: "443", StatusCode: "HTTP_301" }
            }]
        }));
        console.log(`✅ Created HTTP -> HTTPS Redirect Listener`);

        console.log("\n🎉 INFRASTRUCTURE SETUP COMPLETE!");
        console.log("==========================================================");
        console.log(`🚨 FINAL ACTION REQUIRED: Add a Wildcard CNAME to your registrar to point all apps to BravoCloud:`);
        console.log(`Type: CNAME`);
        console.log(`Name/Host: *`);
        console.log(`Value/Target: ${albDns}`);
        console.log("==========================================================");

    } catch (e) {
        console.error("❌ Setup Failed:", e);
    }
}

setup();
