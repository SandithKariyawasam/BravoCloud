"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAwsAccountId = getAwsAccountId;
exports.createEcrRepository = createEcrRepository;
exports.deployToECS = deployToECS;
exports.getEcsTaskPublicIp = getEcsTaskPublicIp;
const client_ecr_1 = require("@aws-sdk/client-ecr");
const client_sts_1 = require("@aws-sdk/client-sts");
const client_iam_1 = require("@aws-sdk/client-iam");
const client_ec2_1 = require("@aws-sdk/client-ec2");
const client_ecs_1 = require("@aws-sdk/client-ecs");
const client_elastic_load_balancing_v2_1 = require("@aws-sdk/client-elastic-load-balancing-v2");
const region = process.env.AWS_REGION || "us-east-1";
// Ensure AWS credentials are set in .env
const ecrClient = new client_ecr_1.ECRClient({ region });
const stsClient = new client_sts_1.STSClient({ region });
const iamClient = new client_iam_1.IAMClient({ region });
const ec2Client = new client_ec2_1.EC2Client({ region });
const ecsClient = new client_ecs_1.ECSClient({ region });
async function getAwsAccountId() {
    const response = await stsClient.send(new client_sts_1.GetCallerIdentityCommand({}));
    return response.Account || "";
}
async function getOrCreateEcsExecutionRole() {
    const roleName = "ecsTaskExecutionRole";
    try {
        const roleResponse = await iamClient.send(new client_iam_1.GetRoleCommand({ RoleName: roleName }));
        return roleResponse.Role?.Arn || "";
    }
    catch (error) {
        if (error.name !== "NoSuchEntityException") {
            throw error;
        }
    }
    // Create role
    const trustPolicy = {
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Principal: {
                    Service: "ecs-tasks.amazonaws.com"
                },
                Action: "sts:AssumeRole"
            }
        ]
    };
    const createRoleRes = await iamClient.send(new client_iam_1.CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify(trustPolicy)
    }));
    const roleArn = createRoleRes.Role?.Arn;
    await iamClient.send(new client_iam_1.AttachRolePolicyCommand({
        RoleName: roleName,
        PolicyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
    }));
    // Wait for IAM propagation
    await new Promise(resolve => setTimeout(resolve, 10000));
    return roleArn || "";
}
async function createEcrRepository(projectName) {
    const repoName = `bravocloud-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    try {
        // Check if it exists
        const describeCmd = new client_ecr_1.DescribeRepositoriesCommand({ repositoryNames: [repoName] });
        const response = await ecrClient.send(describeCmd);
        if (response.repositories && response.repositories.length > 0 && response.repositories[0].repositoryUri) {
            return response.repositories[0].repositoryUri;
        }
    }
    catch (error) {
        if (error.name !== "RepositoryNotFoundException") {
            throw error;
        }
    }
    // Create if it doesn't exist
    const createCmd = new client_ecr_1.CreateRepositoryCommand({
        repositoryName: repoName,
        imageScanningConfiguration: { scanOnPush: true }
    });
    const createResponse = await ecrClient.send(createCmd);
    if (!createResponse.repository?.repositoryUri) {
        throw new Error("Failed to create ECR repository");
    }
    return createResponse.repository.repositoryUri;
}
async function getNetworkConfiguration(port) {
    // 1. Get Default VPC
    const vpcRes = await ec2Client.send(new client_ec2_1.DescribeVpcsCommand({
        Filters: [{ Name: "isDefault", Values: ["true"] }]
    }));
    const vpcId = vpcRes.Vpcs?.[0]?.VpcId;
    if (!vpcId)
        throw new Error("No default VPC found");
    // 2. Get Subnets for VPC
    const subnetRes = await ec2Client.send(new client_ec2_1.DescribeSubnetsCommand({
        Filters: [{ Name: "vpc-id", Values: [vpcId] }]
    }));
    const subnets = subnetRes.Subnets?.map(s => s.SubnetId) || [];
    if (subnets.length === 0)
        throw new Error("No subnets found in default VPC");
    // 3. Create or get Security Group
    const sgName = `bravocloud-ecs-sg-${port}`;
    let sgId = "";
    try {
        const createSgRes = await ec2Client.send(new client_ec2_1.CreateSecurityGroupCommand({
            GroupName: sgName,
            Description: `Allow inbound traffic on port ${port} for BravoCloud ECS`,
            VpcId: vpcId
        }));
        sgId = createSgRes.GroupId;
        // Add Ingress rule
        await ec2Client.send(new client_ec2_1.AuthorizeSecurityGroupIngressCommand({
            GroupId: sgId,
            IpPermissions: [{
                    IpProtocol: "tcp",
                    FromPort: parseInt(port),
                    ToPort: parseInt(port),
                    IpRanges: [{ CidrIp: "0.0.0.0/0" }]
                }]
        }));
    }
    catch (error) {
        if (error.name === "InvalidGroup.Duplicate") {
            const descSgRes = await ec2Client.send(new client_ec2_1.DescribeSecurityGroupsCommand({
                GroupNames: [sgName]
            }));
            sgId = descSgRes.SecurityGroups?.[0]?.GroupId;
        }
        else {
            throw error;
        }
    }
    return { subnets, sgId };
}
async function deployToECS(projectName, imageUri, envVars, port = "3000") {
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const clusterName = `bravocloud-cluster`;
    const familyName = `bravocloud-task-${sanitizedName}`;
    // 1. Create/Ensure Cluster
    await ecsClient.send(new client_ecs_1.CreateClusterCommand({ clusterName }));
    // 2. Get Execution Role
    const executionRoleArn = await getOrCreateEcsExecutionRole();
    // 3. Ensure CloudWatch Log Group exists
    const { CloudWatchLogsClient, CreateLogGroupCommand } = require("@aws-sdk/client-cloudwatch-logs");
    const cwClient = new CloudWatchLogsClient({ region });
    const logGroupName = `/ecs/bravocloud/${sanitizedName}`;
    try {
        await cwClient.send(new CreateLogGroupCommand({ logGroupName }));
    }
    catch (err) {
        if (err.name !== "ResourceAlreadyExistsException") {
            console.warn("Log group creation warning:", err.message);
        }
    }
    // 4. Register Task Definition
    const environment = envVars ? Object.entries(envVars).map(([name, value]) => ({ name, value })) : [];
    const taskDefRes = await ecsClient.send(new client_ecs_1.RegisterTaskDefinitionCommand({
        family: familyName,
        networkMode: "awsvpc",
        requiresCompatibilities: ["FARGATE"],
        cpu: "256",
        memory: "512",
        executionRoleArn: executionRoleArn,
        containerDefinitions: [{
                name: "app",
                image: imageUri,
                portMappings: [{ containerPort: parseInt(port), hostPort: parseInt(port) }],
                environment: environment,
                essential: true,
                logConfiguration: {
                    logDriver: "awslogs",
                    options: {
                        "awslogs-group": logGroupName,
                        "awslogs-region": region,
                        "awslogs-stream-prefix": "ecs"
                    }
                }
            }]
    }));
    const taskDefArn = taskDefRes.taskDefinition?.taskDefinitionArn;
    if (!taskDefArn)
        throw new Error("Failed to register task definition");
    // 4. Get Network Config
    const { subnets, sgId } = await getNetworkConfiguration(port);
    const serviceName = `bravocloud-service-${sanitizedName}`;
    // 5. Setup Load Balancer Routing
    const elbClient = new client_elastic_load_balancing_v2_1.ElasticLoadBalancingV2Client({ region });
    const albRes = await elbClient.send(new client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand({ Names: ["bravocloud-alb"] }));
    const albArn = albRes.LoadBalancers?.[0]?.LoadBalancerArn;
    const albVpcId = albRes.LoadBalancers?.[0]?.VpcId;
    if (!albArn || !albVpcId)
        throw new Error("ALB not found");
    const listRes = await elbClient.send(new client_elastic_load_balancing_v2_1.DescribeListenersCommand({ LoadBalancerArn: albArn }));
    const httpsListenerArn = listRes.Listeners?.find(l => l.Port === 443)?.ListenerArn;
    const httpListenerArn = listRes.Listeners?.find(l => l.Port === 80)?.ListenerArn;
    if (!httpsListenerArn)
        throw new Error("HTTPS Listener not found");
    // Create Target Group for this project
    const tgName = `bravocloud-tg-${sanitizedName}`.substring(0, 32); // Max 32 chars
    let tgArn = "";
    try {
        const tgRes = await elbClient.send(new client_elastic_load_balancing_v2_1.CreateTargetGroupCommand({
            Name: tgName,
            Protocol: "HTTP",
            Port: parseInt(port),
            VpcId: albVpcId,
            TargetType: "ip",
            HealthCheckPath: "/",
            HealthCheckIntervalSeconds: 60
        }));
        tgArn = tgRes.TargetGroups?.[0]?.TargetGroupArn || "";
    }
    catch (e) {
        if (e.name === "DuplicateTargetGroupNameException" || e.name === "DuplicateTargetGroupName") {
            const descRes = await elbClient.send(new client_elastic_load_balancing_v2_1.DescribeTargetGroupsCommand({ Names: [tgName] }));
            tgArn = descRes.TargetGroups?.[0]?.TargetGroupArn || "";
        }
        else {
            console.error("Target Group creation failed", e);
            throw e;
        }
    }
    // Create Listener Rule for Host Routing
    try {
        // Attempt to create the rule. Note: in a real production system, you would check if it exists first.
        const priority = Math.floor(Math.random() * 49999) + 1;
        await elbClient.send(new client_elastic_load_balancing_v2_1.CreateRuleCommand({
            ListenerArn: httpsListenerArn,
            Conditions: [{ Field: "host-header", HostHeaderConfig: { Values: [`${sanitizedName}.bravocloud.tech`] } }],
            Priority: priority,
            Actions: [{ Type: "forward", TargetGroupArn: tgArn }]
        }));
    }
    catch (ruleErr) {
        // If priority is taken or rule exists, ignore for now as it routes to the correct TG
        console.log("HTTPS Rule might already exist, proceeding...");
    }
    // Create HTTP to HTTPS Redirect Rule
    if (httpListenerArn) {
        try {
            const httpPriority = Math.floor(Math.random() * 49999) + 1;
            await elbClient.send(new client_elastic_load_balancing_v2_1.CreateRuleCommand({
                ListenerArn: httpListenerArn,
                Conditions: [{ Field: "host-header", HostHeaderConfig: { Values: [`${sanitizedName}.bravocloud.tech`] } }],
                Priority: httpPriority,
                Actions: [{
                        Type: "redirect",
                        RedirectConfig: {
                            Protocol: "HTTPS",
                            Port: "443",
                            StatusCode: "HTTP_301"
                        }
                    }]
            }));
        }
        catch (httpRuleErr) {
            console.log("HTTP Redirect Rule might already exist, proceeding...");
        }
    }
    // 6. Create or Recreate Service
    const createServiceInput = {
        cluster: clusterName,
        serviceName: serviceName,
        taskDefinition: taskDefArn,
        launchType: "FARGATE",
        desiredCount: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                subnets: subnets,
                securityGroups: [sgId],
                assignPublicIp: "ENABLED"
            }
        },
        loadBalancers: [{
                targetGroupArn: tgArn,
                containerName: "app",
                containerPort: parseInt(port)
            }]
    };
    try {
        await ecsClient.send(new client_ecs_1.CreateServiceCommand(createServiceInput));
    }
    catch (err) {
        console.log(`CreateService failed (${err.name}), attempting UpdateService...`);
        const { UpdateServiceCommand } = require("@aws-sdk/client-ecs");
        try {
            await ecsClient.send(new UpdateServiceCommand({
                cluster: clusterName,
                service: serviceName,
                taskDefinition: taskDefArn,
                desiredCount: 1,
                forceNewDeployment: true // This forces a rolling update!
            }));
            console.log("Service updated successfully with new deployment!");
        }
        catch (updateErr) {
            if (updateErr.name === "InvalidParameterException" || err.message.includes("idempotent")) {
                // Fallback for massive structural changes (like adding LB)
                const { DeleteServiceCommand } = require("@aws-sdk/client-ecs");
                console.log("Service update failed, recreating service...");
                await ecsClient.send(new DeleteServiceCommand({ cluster: clusterName, service: serviceName, force: true }));
                await new Promise(r => setTimeout(r, 5000));
                await ecsClient.send(new client_ecs_1.CreateServiceCommand(createServiceInput));
            }
            else {
                throw updateErr;
            }
        }
    }
    return `https://${sanitizedName}.bravocloud.tech`;
}
async function getEcsTaskPublicIp(projectName) {
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const clusterName = `bravocloud-cluster`;
    const serviceName = `bravocloud-service-${sanitizedName}`;
    try {
        const { ECSClient, ListTasksCommand, DescribeTasksCommand } = require("@aws-sdk/client-ecs");
        const { EC2Client, DescribeNetworkInterfacesCommand } = require("@aws-sdk/client-ec2");
        const region = process.env.AWS_REGION || "us-east-1";
        const ecs = new ECSClient({ region });
        const ec2 = new EC2Client({ region });
        let eniIdDetail;
        // Poll up to 30 times (1 minute) for the task to reach RUNNING state and have an ENI
        for (let i = 0; i < 30; i++) {
            const listRes = await ecs.send(new ListTasksCommand({
                cluster: clusterName,
                serviceName: serviceName,
                desiredStatus: "RUNNING"
            }));
            if (listRes.taskArns && listRes.taskArns.length > 0) {
                const descRes = await ecs.send(new DescribeTasksCommand({
                    cluster: clusterName,
                    tasks: [listRes.taskArns[0]]
                }));
                const task = descRes.tasks?.[0];
                if (task) {
                    const eniAttachment = task.attachments?.find((a) => a.type === "ElasticNetworkInterface");
                    if (eniAttachment) {
                        eniIdDetail = eniAttachment.details?.find((d) => d.name === "networkInterfaceId");
                        if (eniIdDetail && eniIdDetail.value) {
                            break; // Found it!
                        }
                    }
                }
            }
            // Wait 2 seconds before checking again
            await new Promise(r => setTimeout(r, 2000));
        }
        if (!eniIdDetail || !eniIdDetail.value)
            return null;
        // 3. Get Public IP from ENI
        const ec2Res = await ec2.send(new DescribeNetworkInterfacesCommand({
            NetworkInterfaceIds: [eniIdDetail.value]
        }));
        const eni = ec2Res.NetworkInterfaces?.[0];
        if (!eni || !eni.Association || !eni.Association.PublicIp)
            return null;
        return eni.Association.PublicIp;
    }
    catch (e) {
        console.error("Failed to get ECS task IP:", e);
        return null;
    }
}
