"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAwsAccountId = getAwsAccountId;
exports.createEcrRepository = createEcrRepository;
exports.deployToECS = deployToECS;
const client_ecr_1 = require("@aws-sdk/client-ecr");
const client_sts_1 = require("@aws-sdk/client-sts");
const client_iam_1 = require("@aws-sdk/client-iam");
const client_ec2_1 = require("@aws-sdk/client-ec2");
const client_ecs_1 = require("@aws-sdk/client-ecs");
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
    // 3. Register Task Definition
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
                essential: true
            }]
    }));
    const taskDefArn = taskDefRes.taskDefinition?.taskDefinitionArn;
    if (!taskDefArn)
        throw new Error("Failed to register task definition");
    // 4. Get Network Config
    const { subnets, sgId } = await getNetworkConfiguration(port);
    // 5. Run Task
    const runTaskRes = await ecsClient.send(new client_ecs_1.RunTaskCommand({
        cluster: clusterName,
        taskDefinition: taskDefArn,
        launchType: "FARGATE",
        networkConfiguration: {
            awsvpcConfiguration: {
                subnets: subnets,
                securityGroups: [sgId],
                assignPublicIp: "ENABLED"
            }
        }
    }));
    const taskArn = runTaskRes.tasks?.[0]?.taskArn;
    if (!taskArn)
        throw new Error("Failed to run ECS task");
    // 6. Wait for Task ENI attachment
    let eniId = "";
    for (let i = 0; i < 15; i++) {
        await new Promise(res => setTimeout(res, 3000));
        const descTask = await ecsClient.send(new client_ecs_1.DescribeTasksCommand({
            cluster: clusterName,
            tasks: [taskArn]
        }));
        const task = descTask.tasks?.[0];
        const eniDetail = task?.attachments?.[0]?.details?.find(d => d.name === "networkInterfaceId");
        if (eniDetail?.value) {
            eniId = eniDetail.value;
            break;
        }
    }
    if (!eniId) {
        console.log("Could not find ENI for task in time.");
        return `http://pending-ecs-provisioning`;
    }
    // 7. Get Public IP from ENI
    const eniRes = await ec2Client.send(new client_ec2_1.DescribeNetworkInterfacesCommand({
        NetworkInterfaceIds: [eniId]
    }));
    const publicIp = eniRes.NetworkInterfaces?.[0]?.Association?.PublicIp;
    if (!publicIp)
        throw new Error("Task ENI has no public IP assigned");
    return `http://${publicIp}:${port}`;
}
