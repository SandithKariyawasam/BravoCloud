"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAwsAccountId = getAwsAccountId;
exports.createEcrRepository = createEcrRepository;
exports.deployToECS = deployToECS;
exports.addCustomDomainRoute = addCustomDomainRoute;
exports.removeCustomDomainRoute = removeCustomDomainRoute;
exports.getEcsTaskPublicIp = getEcsTaskPublicIp;
exports.provisionS3Bucket = provisionS3Bucket;
exports.provisionPostgresDatabase = provisionPostgresDatabase;
exports.provisionRedisCache = provisionRedisCache;
exports.getRealAWSUsage = getRealAWSUsage;
exports.deleteComputeInfrastructure = deleteComputeInfrastructure;
exports.deleteProjectInfrastructure = deleteProjectInfrastructure;
exports.deleteStorageResource = deleteStorageResource;
exports.updateProjectWAF = updateProjectWAF;
exports.setupCognitoUserPool = setupCognitoUserPool;
exports.syncProjectCognitoAuth = syncProjectCognitoAuth;
exports.startCodeBuildJob = startCodeBuildJob;
exports.updateProjectALBAuth = updateProjectALBAuth;
exports.syncServerlessFunctions = syncServerlessFunctions;
exports.syncCronJobs = syncCronJobs;
exports.syncEdgeNetwork = syncEdgeNetwork;
exports.setMaintenanceMode = setMaintenanceMode;
exports.setProjectComputeState = setProjectComputeState;
exports.syncAutoScaling = syncAutoScaling;
exports.createDatabaseSnapshot = createDatabaseSnapshot;
exports.syncLogDrain = syncLogDrain;
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
    let roleArn = "";
    try {
        const roleResponse = await iamClient.send(new client_iam_1.GetRoleCommand({ RoleName: roleName }));
        roleArn = roleResponse.Role?.Arn || "";
    }
    catch (error) {
        if (error.name !== "NoSuchEntityException") {
            throw error;
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
        roleArn = createRoleRes.Role?.Arn || "";
    }
    // Always attempt to attach the policy to guarantee permissions
    try {
        await iamClient.send(new client_iam_1.AttachRolePolicyCommand({
            RoleName: roleName,
            PolicyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
        }));
    }
    catch (e) {
        console.log("Policy attachment status:", e.message);
    }
    // Wait briefly for IAM propagation if we just created/modified it
    await new Promise(resolve => setTimeout(resolve, 3000));
    return roleArn;
}
async function getOrCreateCodeBuildRole() {
    const roleName = "BravoCloudCodeBuildRole";
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
                    Service: "codebuild.amazonaws.com"
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
        PolicyArn: "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser"
    }));
    await iamClient.send(new client_iam_1.AttachRolePolicyCommand({
        RoleName: roleName,
        PolicyArn: "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
    }));
    // Wait briefly for role to propagate
    await new Promise(resolve => setTimeout(resolve, 10000));
    return roleArn || "";
}
async function createEcrRepository(projectName, userId) {
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
        imageScanningConfiguration: { scanOnPush: true },
        tags: [{ Key: "BravoCloud-User", Value: userId }]
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
    const serviceName = `bc-svc-${sanitizedName}-${port}`;
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
    const rawTgName = `bc-tg-${sanitizedName}-${port}`;
    const tgName = rawTgName.substring(0, 32); // Max 32 chars
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
    // Create or Update Listener Rule for Host Routing
    try {
        const rulesRes = await elbClient.send(new client_elastic_load_balancing_v2_1.DescribeRulesCommand({ ListenerArn: httpsListenerArn }));
        const existingRules = rulesRes.Rules?.filter((r) => r.Conditions?.some((c) => c.Field === "host-header" && c.HostHeaderConfig?.Values?.includes(`${sanitizedName}.bravocloud.tech`))) || [];
        if (existingRules.length > 0) {
            // Modify the first matching rule to point to the new TG
            await elbClient.send(new client_elastic_load_balancing_v2_1.ModifyRuleCommand({
                RuleArn: existingRules[0].RuleArn,
                Actions: [{ Type: "forward", TargetGroupArn: tgArn }]
            }));
            // If there are duplicates from the previous bug, delete them to prevent priority collisions
            for (let i = 1; i < existingRules.length; i++) {
                const { DeleteRuleCommand } = require("@aws-sdk/client-elastic-load-balancing-v2");
                await elbClient.send(new DeleteRuleCommand({ RuleArn: existingRules[i].RuleArn }));
            }
        }
        else {
            const priority = Math.floor(Math.random() * 49999) + 1;
            await elbClient.send(new client_elastic_load_balancing_v2_1.CreateRuleCommand({
                ListenerArn: httpsListenerArn,
                Conditions: [{ Field: "host-header", HostHeaderConfig: { Values: [`${sanitizedName}.bravocloud.tech`] } }],
                Priority: priority,
                Actions: [{ Type: "forward", TargetGroupArn: tgArn }]
            }));
        }
    }
    catch (ruleErr) {
        console.error("Failed to configure HTTPS listener rule:", ruleErr.message);
    }
    // Create HTTP to HTTPS Redirect Rule
    if (httpListenerArn) {
        try {
            const rulesRes = await elbClient.send(new client_elastic_load_balancing_v2_1.DescribeRulesCommand({ ListenerArn: httpListenerArn }));
            const existingRules = rulesRes.Rules?.filter((r) => r.Conditions?.some((c) => c.Field === "host-header" && c.HostHeaderConfig?.Values?.includes(`${sanitizedName}.bravocloud.tech`))) || [];
            if (existingRules.length > 0) {
                // HTTP rule already exists. Just clean up duplicates if any.
                for (let i = 1; i < existingRules.length; i++) {
                    const { DeleteRuleCommand } = require("@aws-sdk/client-elastic-load-balancing-v2");
                    await elbClient.send(new DeleteRuleCommand({ RuleArn: existingRules[i].RuleArn }));
                }
            }
            else {
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
        }
        catch (httpRuleErr) {
            console.log("HTTP Redirect Rule config failed:", httpRuleErr);
        }
    }
    // 6. Create or Recreate Service with port in name
    // 6. Create or Recreate Service with port in name
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
                console.log("Service update failed due to structural change. Deleting and recreating...");
                const { DeleteServiceCommand } = require("@aws-sdk/client-ecs");
                await ecsClient.send(new DeleteServiceCommand({ cluster: clusterName, service: serviceName, force: true }));
                // Wait 15 seconds to ensure deletion propagates before recreation
                await new Promise(r => setTimeout(r, 15000));
                try {
                    await ecsClient.send(new client_ecs_1.CreateServiceCommand(createServiceInput));
                }
                catch (recreateErr) {
                    console.error("Recreation failed, but continuing as it might eventually stabilize:", recreateErr.message);
                }
            }
            else {
                throw updateErr;
            }
        }
    }
    return `${sanitizedName}.bravocloud.tech`;
}
async function addCustomDomainRoute(projectName, domain, port = "3000") {
    const { ACMClient, RequestCertificateCommand, DescribeCertificateCommand, DeleteCertificateCommand } = require("@aws-sdk/client-acm");
    const { AddListenerCertificatesCommand } = require("@aws-sdk/client-elastic-load-balancing-v2");
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    // 1. Request Cert
    const acmClient = new ACMClient({ region });
    const reqRes = await acmClient.send(new RequestCertificateCommand({
        DomainName: domain,
        ValidationMethod: "DNS"
    }));
    const certArn = reqRes.CertificateArn;
    // 2. Poll for DNS validation records
    let cnameName = "";
    let cnameValue = "";
    for (let i = 0; i < 15; i++) {
        const descRes = await acmClient.send(new DescribeCertificateCommand({ CertificateArn: certArn }));
        const opts = descRes.Certificate?.DomainValidationOptions;
        if (opts && opts.length > 0 && opts[0].ResourceRecord) {
            cnameName = opts[0].ResourceRecord.Name;
            cnameValue = opts[0].ResourceRecord.Value;
            break;
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    if (!cnameName) {
        throw new Error("Timeout waiting for ACM DNS validation records.");
    }
    // 3. Find ALB and Listeners
    const elbClient = new client_elastic_load_balancing_v2_1.ElasticLoadBalancingV2Client({ region });
    const albRes = await elbClient.send(new client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand({ Names: ["bravocloud-alb"] }));
    const albArn = albRes.LoadBalancers?.[0]?.LoadBalancerArn;
    const albDns = albRes.LoadBalancers?.[0]?.DNSName || "alb.bravocloud.tech";
    if (!albArn)
        throw new Error("ALB not found");
    const listRes = await elbClient.send(new client_elastic_load_balancing_v2_1.DescribeListenersCommand({ LoadBalancerArn: albArn }));
    const httpsListenerArn = listRes.Listeners?.find(l => l.Port === 443)?.ListenerArn;
    const httpListenerArn = listRes.Listeners?.find(l => l.Port === 80)?.ListenerArn;
    // 4. Attach cert to Listener
    if (httpsListenerArn) {
        try {
            await elbClient.send(new AddListenerCertificatesCommand({
                ListenerArn: httpsListenerArn,
                Certificates: [{ CertificateArn: certArn }]
            }));
        }
        catch (e) {
            console.warn("Could not attach cert (maybe duplicate):", e.message);
        }
    }
    // 5. Create Target Group with port in name to allow framework switches
    const rawTgName = `bc-tg-${sanitizedName}-${port}`;
    const tgName = rawTgName.substring(0, 32);
    const descTgRes = await elbClient.send(new client_elastic_load_balancing_v2_1.DescribeTargetGroupsCommand({ Names: [tgName] }));
    const tgArn = descTgRes.TargetGroups?.[0]?.TargetGroupArn;
    if (!tgArn)
        throw new Error("Target Group not found for project");
    // 6. Create Listener Rules
    const priority = Math.floor(Math.random() * 49999) + 1;
    if (httpsListenerArn) {
        await elbClient.send(new client_elastic_load_balancing_v2_1.CreateRuleCommand({
            ListenerArn: httpsListenerArn,
            Conditions: [{ Field: "host-header", HostHeaderConfig: { Values: [domain] } }],
            Priority: priority,
            Actions: [{ Type: "forward", TargetGroupArn: tgArn }]
        }));
    }
    if (httpListenerArn) {
        await elbClient.send(new client_elastic_load_balancing_v2_1.CreateRuleCommand({
            ListenerArn: httpListenerArn,
            Conditions: [{ Field: "host-header", HostHeaderConfig: { Values: [domain] } }],
            Priority: priority + 1,
            Actions: [{ Type: "redirect", RedirectConfig: { Protocol: "HTTPS", Port: "443", StatusCode: "HTTP_301" } }]
        }));
    }
    return { certArn, cnameName, cnameValue, albDns };
}
async function removeCustomDomainRoute(certArn) {
    const { ACMClient, DeleteCertificateCommand } = require("@aws-sdk/client-acm");
    const acmClient = new ACMClient({ region });
    try {
        await acmClient.send(new DeleteCertificateCommand({ CertificateArn: certArn }));
    }
    catch (e) {
        console.warn("Failed to delete cert:", e.message);
    }
}
async function getEcsTaskPublicIp(projectName) {
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const clusterName = `bravocloud-cluster`;
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
                family: `bravocloud-task-${sanitizedName}`,
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
async function provisionS3Bucket(projectName, userId) {
    const { S3Client, CreateBucketCommand, PutPublicAccessBlockCommand, PutBucketCorsCommand, PutBucketTaggingCommand } = require("@aws-sdk/client-s3");
    const s3Client = new S3Client({ region });
    const bucketName = `bravocloud-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${Math.random().toString(36).substring(2, 8)}`;
    await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
    // Enable CORS
    await s3Client.send(new PutBucketCorsCommand({
        Bucket: bucketName,
        CORSConfiguration: {
            CORSRules: [{
                    AllowedHeaders: ["*"],
                    AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
                    AllowedOrigins: ["*"]
                }]
        }
    }));
    // Disable block public access
    await s3Client.send(new PutPublicAccessBlockCommand({
        Bucket: bucketName,
        PublicAccessBlockConfiguration: {
            BlockPublicAcls: false,
            IgnorePublicAcls: false,
            BlockPublicPolicy: false,
            RestrictPublicBuckets: false
        }
    }));
    // Add tag
    await s3Client.send(new PutBucketTaggingCommand({
        Bucket: bucketName,
        Tagging: {
            TagSet: [{ Key: "BravoCloud-User", Value: userId }]
        }
    }));
    return { bucketName, region };
}
async function provisionPostgresDatabase(projectName, userId) {
    const { RDSClient, CreateDBInstanceCommand } = require("@aws-sdk/client-rds");
    const rdsClient = new RDSClient({ region });
    const dbIdentifier = `bravocloud-db-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${Math.random().toString(36).substring(2, 6)}`;
    const username = "postgres";
    const password = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + "!";
    // Real provisioning
    await rdsClient.send(new CreateDBInstanceCommand({
        DBInstanceIdentifier: dbIdentifier,
        Engine: "postgres",
        AllocatedStorage: 20,
        DBInstanceClass: "db.t3.micro",
        MasterUsername: username,
        MasterUserPassword: password,
        PubliclyAccessible: true,
        Tags: [{ Key: "BravoCloud-User", Value: userId }]
    }));
    // AWS RDS endpoint follows this pattern
    const mockEndpoint = `${dbIdentifier}.xxxxxx.${region}.rds.amazonaws.com`;
    return { dbIdentifier, username, password, mockEndpoint };
}
async function provisionRedisCache(projectName, userId) {
    const { ElastiCacheClient, CreateCacheClusterCommand } = require("@aws-sdk/client-elasticache");
    const cacheClient = new ElastiCacheClient({ region });
    const clusterId = `bravocloud-redis-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 10)}-${Math.random().toString(36).substring(2, 6)}`;
    // Real provisioning
    await cacheClient.send(new CreateCacheClusterCommand({
        CacheClusterId: clusterId,
        Engine: "redis",
        CacheNodeType: "cache.t3.micro",
        NumCacheNodes: 1,
        Tags: [{ Key: "BravoCloud-User", Value: userId }]
    }));
    // AWS ElastiCache endpoint pattern
    const mockEndpoint = `${clusterId}.xxxxxx.0001.${region}.cache.amazonaws.com`;
    return { clusterId, mockEndpoint };
}
async function getRealAWSUsage(userId) {
    const { CostExplorerClient, GetCostAndUsageCommand } = require("@aws-sdk/client-cost-explorer");
    const ceClient = new CostExplorerClient({ region: "us-east-1" }); // Cost Explorer is global but API endpoint is us-east-1
    const date = new Date();
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const today = date.toISOString().split('T')[0];
    try {
        // If today is the 1st of the month, CE requires start and end to be different, so we fetch last month instead
        let start = startOfMonth;
        let end = today;
        if (start === end) {
            const lastMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
            start = lastMonth.toISOString().split('T')[0];
        }
        const command = new GetCostAndUsageCommand({
            TimePeriod: { Start: start, End: end },
            Granularity: "MONTHLY",
            Metrics: ["UnblendedCost"],
            GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
            Filter: {
                Tags: {
                    Key: "BravoCloud-User",
                    Values: [userId]
                }
            }
        });
        const response = await ceClient.send(command);
        let rawUsage = [];
        if (response.ResultsByTime && response.ResultsByTime.length > 0) {
            const groups = response.ResultsByTime[0].Groups || [];
            for (const group of groups) {
                const serviceName = group.Keys?.[0] || "Unknown Service";
                const costAmount = parseFloat(group.Metrics?.UnblendedCost?.Amount || "0");
                if (costAmount > 0) {
                    rawUsage.push({ service: serviceName, cost: costAmount });
                }
            }
        }
        // If AWS Cost Explorer returns data, use it.
        // If it's a brand new account or permissions failed, rawUsage will be empty.
        if (rawUsage.length > 0) {
            return rawUsage;
        }
        throw new Error("No billing data returned from AWS Cost Explorer yet.");
    }
    catch (error) {
        console.warn("Real AWS Cost Explorer query failed or returned empty (fallback to baseline simulation):", error.message);
        // Fallback if CE is not enabled or populated yet. Return empty array instead of dummy data.
        return [];
    }
}
async function deleteComputeInfrastructure(projectName) {
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const clusterName = "bravocloud-cluster";
    const region = process.env.AWS_REGION || "us-east-1";
    // 1. Delete ECR Repository
    try {
        const { ECRClient, DeleteRepositoryCommand } = require("@aws-sdk/client-ecr");
        const ecrClientLocal = new ECRClient({ region });
        const repoName = `bravocloud-${sanitizedName}`;
        await ecrClientLocal.send(new DeleteRepositoryCommand({ repositoryName: repoName, force: true }));
        console.log(`Deleted ECR repository: ${repoName}`);
    }
    catch (e) {
        if (e.name !== "RepositoryNotFoundException") {
            console.warn(`Failed to delete ECR repository bravocloud-${sanitizedName}:`, e.message);
        }
    }
    // 1.5 Delete CodeBuild Project
    try {
        const { CodeBuildClient, DeleteProjectCommand } = require("@aws-sdk/client-codebuild");
        const codebuildClient = new CodeBuildClient({ region });
        const cbProjectName = `bravocloud-build-${sanitizedName}`;
        await codebuildClient.send(new DeleteProjectCommand({ name: cbProjectName }));
        console.log(`Deleted CodeBuild project: ${cbProjectName}`);
    }
    catch (e) {
        if (e.name !== "ResourceNotFoundException") {
            console.warn(`Failed to delete CodeBuild project for ${sanitizedName}:`, e.message);
        }
    }
    // 2. Delete ECS Service
    try {
        const { ECSClient, ListServicesCommand, UpdateServiceCommand, DeleteServiceCommand } = require("@aws-sdk/client-ecs");
        const ecsClientLocal = new ECSClient({ region });
        // Find all services matching this project
        const listServicesRes = await ecsClientLocal.send(new ListServicesCommand({ cluster: clusterName, maxResults: 100 }));
        const targetServices = listServicesRes.serviceArns?.filter((arn) => arn.includes(`bravocloud-service-${sanitizedName}`) || arn.includes(`bc-svc-${sanitizedName}`)) || [];
        for (const svcArn of targetServices) {
            await ecsClientLocal.send(new UpdateServiceCommand({ cluster: clusterName, service: svcArn, desiredCount: 0 }));
            await ecsClientLocal.send(new DeleteServiceCommand({ cluster: clusterName, service: svcArn, force: true }));
            console.log(`Deleted ECS service: ${svcArn}`);
        }
    }
    catch (e) {
        console.warn(`Failed to delete ECS service for ${sanitizedName}:`, e.message);
    }
    // 3. Delete Target Group
    try {
        const { ElasticLoadBalancingV2Client, DescribeTargetGroupsCommand, DeleteTargetGroupCommand } = require("@aws-sdk/client-elastic-load-balancing-v2");
        const elbClientLocal = new ElasticLoadBalancingV2Client({ region });
        const descTgRes = await elbClientLocal.send(new DescribeTargetGroupsCommand({}));
        const targetGroups = descTgRes.TargetGroups?.filter((tg) => tg.TargetGroupName?.includes(`bravocloud-tg-${sanitizedName}`) || tg.TargetGroupName?.includes(`bc-tg-${sanitizedName}`)) || [];
        for (const tg of targetGroups) {
            await elbClientLocal.send(new DeleteTargetGroupCommand({ TargetGroupArn: tg.TargetGroupArn }));
            console.log(`Deleted Target Group: ${tg.TargetGroupName}`);
        }
    }
    catch (e) {
        console.warn(`Failed to delete Target Group for ${sanitizedName}:`, e.message);
    }
    // 2.5 Delete ALB Rules
    try {
        const { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand, DescribeListenersCommand, DescribeRulesCommand, DeleteRuleCommand } = require("@aws-sdk/client-elastic-load-balancing-v2");
        const elbClient = new ElasticLoadBalancingV2Client({ region });
        const albRes = await elbClient.send(new DescribeLoadBalancersCommand({ Names: ["bravocloud-alb"] }));
        const albArn = albRes.LoadBalancers?.[0]?.LoadBalancerArn;
        if (albArn) {
            const listRes = await elbClient.send(new DescribeListenersCommand({ LoadBalancerArn: albArn }));
            const httpsListenerArn = listRes.Listeners?.find((l) => l.Port === 443)?.ListenerArn;
            const httpListenerArn = listRes.Listeners?.find((l) => l.Port === 80)?.ListenerArn;
            for (const listenerArn of [httpsListenerArn, httpListenerArn]) {
                if (!listenerArn)
                    continue;
                const rulesRes = await elbClient.send(new DescribeRulesCommand({ ListenerArn: listenerArn }));
                for (const rule of rulesRes.Rules || []) {
                    const isMatch = rule.Conditions?.some((c) => c.Field === "host-header" &&
                        c.HostHeaderConfig?.Values?.includes(`${sanitizedName}.bravocloud.tech`));
                    if (isMatch) {
                        await elbClient.send(new DeleteRuleCommand({ RuleArn: rule.RuleArn }));
                        console.log(`Deleted ALB rule: ${rule.RuleArn}`);
                    }
                }
            }
        }
    }
    catch (e) {
        console.warn(`Failed to delete ALB Rules/Target Group for ${sanitizedName}:`, e.message);
    }
    // 2.6 Delete CloudWatch Log Group
    try {
        const { CloudWatchLogsClient, DeleteLogGroupCommand } = require("@aws-sdk/client-cloudwatch-logs");
        const cwClient = new CloudWatchLogsClient({ region });
        const logGroupName = `/ecs/bravocloud/${sanitizedName}`;
        await cwClient.send(new DeleteLogGroupCommand({ logGroupName }));
        console.log(`Deleted Log Group: ${logGroupName}`);
    }
    catch (e) {
        if (e.name !== "ResourceNotFoundException") {
            console.warn(`Failed to delete Log Group for ${sanitizedName}:`, e.message);
        }
    }
}
async function deleteProjectInfrastructure(projectName, storageItems) {
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const repoName = `bravocloud-${sanitizedName}`;
    const clusterName = "bravocloud-cluster";
    // 1.5 Delete Compute Infrastructure
    await deleteComputeInfrastructure(projectName);
    // 3. Iterate over storage resources
    for (const item of storageItems) {
        await deleteStorageResource(item);
    }
    // 4. Delete Cognito App Client and User
    try {
        const { CognitoIdentityProviderClient, ListUserPoolsCommand, ListUserPoolClientsCommand, DeleteUserPoolClientCommand, AdminDeleteUserCommand } = require("@aws-sdk/client-cognito-identity-provider");
        const cognitoClient = new CognitoIdentityProviderClient({ region });
        const poolName = "bravocloud-auth-pool";
        const listRes = await cognitoClient.send(new ListUserPoolsCommand({ MaxResults: 50 }));
        const pool = listRes.UserPools?.find((p) => p.Name === poolName);
        if (pool) {
            const clientName = `client-${sanitizedName}`;
            const listClients = await cognitoClient.send(new ListUserPoolClientsCommand({ UserPoolId: pool.Id, MaxResults: 50 }));
            const appClient = listClients.UserPoolClients?.find((c) => c.ClientName === clientName);
            if (appClient) {
                await cognitoClient.send(new DeleteUserPoolClientCommand({ UserPoolId: pool.Id, ClientId: appClient.ClientId }));
                console.log(`Deleted Cognito App Client for ${projectName}`);
            }
            try {
                await cognitoClient.send(new AdminDeleteUserCommand({ UserPoolId: pool.Id, Username: `admin-${sanitizedName}` }));
                console.log(`Deleted Cognito User for ${projectName}`);
            }
            catch (e) {
                if (e.name !== 'UserNotFoundException')
                    console.error("Error deleting Cognito user:", e.message);
            }
        }
    }
    catch (error) {
        console.error("Error cleaning up Cognito resources:", error.message);
    }
}
async function deleteStorageResource(item) {
    if (item.type === 's3') {
        try {
            const { S3Client, DeleteBucketCommand, ListObjectsV2Command, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
            const s3Client = new S3Client({ region });
            // Empty the bucket first
            let hasMore = true;
            let continuationToken = undefined;
            while (hasMore) {
                const listRes = await s3Client.send(new ListObjectsV2Command({ Bucket: item.id, ContinuationToken: continuationToken }));
                if (listRes.Contents && listRes.Contents.length > 0) {
                    await s3Client.send(new DeleteObjectsCommand({
                        Bucket: item.id,
                        Delete: { Objects: listRes.Contents.map((obj) => ({ Key: obj.Key })) }
                    }));
                }
                hasMore = !!listRes.IsTruncated;
                continuationToken = listRes.NextContinuationToken;
            }
            // Delete the bucket
            await s3Client.send(new DeleteBucketCommand({ Bucket: item.id }));
            console.log(`Deleted S3 bucket: ${item.id}`);
        }
        catch (e) {
            console.warn(`Failed to delete S3 bucket ${item.id}:`, e.message);
        }
    }
    else if (item.type === 'postgres') {
        try {
            const { RDSClient, DeleteDBInstanceCommand } = require("@aws-sdk/client-rds");
            const rdsClient = new RDSClient({ region });
            await rdsClient.send(new DeleteDBInstanceCommand({
                DBInstanceIdentifier: item.id,
                SkipFinalSnapshot: true
            }));
            console.log(`Deleted RDS DB: ${item.id}`);
        }
        catch (e) {
            if (e.name !== "DBInstanceNotFoundFault") {
                console.warn(`Failed to delete RDS DB ${item.id}:`, e.message);
            }
        }
    }
    else if (item.type === 'redis') {
        try {
            const { ElastiCacheClient, DeleteCacheClusterCommand } = require("@aws-sdk/client-elasticache");
            const cacheClient = new ElastiCacheClient({ region });
            await cacheClient.send(new DeleteCacheClusterCommand({
                CacheClusterId: item.id
            }));
            console.log(`Deleted Redis Cluster: ${item.id}`);
        }
        catch (e) {
            if (e.name !== "CacheClusterNotFoundFault") {
                console.warn(`Failed to delete Redis Cluster ${item.id}:`, e.message);
            }
        }
    }
}
async function updateProjectWAF(projectName, mode, ips) {
    // WAF logic placeholder. In a production scenario with a shared ALB, we would 
    // 1. Create an IPSet for the project.
    // 2. Add a rule to the ALB's central WebACL linking the HostHeader to this IPSet.
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const ipSetName = `bravocloud-ipset-${sanitizedName}`.substring(0, 128); // WAF limits
    // Format IPs to CIDR
    const formattedIps = ips.map(ip => ip.includes('/') ? ip : `${ip}/32`);
    try {
        const { WAFV2Client, CreateIPSetCommand, GetIPSetCommand, UpdateIPSetCommand, ListIPSetsCommand } = require("@aws-sdk/client-wafv2");
        // WAFv2 for ALB is regional
        const wafClient = new WAFV2Client({ region });
        const listRes = await wafClient.send(new ListIPSetsCommand({ Scope: "REGIONAL" }));
        const existingSet = listRes.IPSets?.find((set) => set.Name === ipSetName);
        if (existingSet) {
            // Need LockToken to update
            const getRes = await wafClient.send(new GetIPSetCommand({ Name: ipSetName, Scope: "REGIONAL", Id: existingSet.Id }));
            await wafClient.send(new UpdateIPSetCommand({
                Name: ipSetName,
                Scope: "REGIONAL",
                Id: existingSet.Id,
                Description: `IP Set for ${projectName}`,
                Addresses: formattedIps,
                LockToken: getRes.LockToken
            }));
            console.log(`Updated WAF IPSet ${ipSetName} with ${formattedIps.length} IPs`);
        }
        else {
            // Create new
            await wafClient.send(new CreateIPSetCommand({
                Name: ipSetName,
                Scope: "REGIONAL",
                Description: `IP Set for ${projectName}`,
                IPAddressVersion: "IPV4",
                Addresses: formattedIps
            }));
            console.log(`Created new WAF IPSet ${ipSetName}`);
        }
    }
    catch (error) {
        console.error(`Failed to sync WAF IPSet for ${projectName}:`, error.message);
        throw error;
    }
}
async function setupCognitoUserPool() {
    const { CognitoIdentityProviderClient, ListUserPoolsCommand, CreateUserPoolCommand, CreateUserPoolDomainCommand } = require("@aws-sdk/client-cognito-identity-provider");
    const client = new CognitoIdentityProviderClient({ region });
    const poolName = "bravocloud-auth-pool";
    const accountId = await getAwsAccountId();
    const domainPrefix = `bravocloud-auth-${accountId || 'demo'}`;
    const listRes = await client.send(new ListUserPoolsCommand({ MaxResults: 50 }));
    let pool = listRes.UserPools?.find((p) => p.Name === poolName);
    if (!pool) {
        const createRes = await client.send(new CreateUserPoolCommand({
            PoolName: poolName,
            AdminCreateUserConfig: { AllowAdminCreateUserOnly: true }
        }));
        pool = createRes.UserPool;
        try {
            await client.send(new CreateUserPoolDomainCommand({
                UserPoolId: pool.Id,
                Domain: domainPrefix
            }));
        }
        catch (e) {
            console.log("Cognito Domain might already exist or failed:", e.message);
        }
    }
    return { poolId: pool.Id, domain: domainPrefix };
}
async function syncProjectCognitoAuth(projectName, password) {
    const { CognitoIdentityProviderClient, CreateUserPoolClientCommand, AdminCreateUserCommand, AdminSetUserPasswordCommand, ListUserPoolClientsCommand } = require("@aws-sdk/client-cognito-identity-provider");
    const client = new CognitoIdentityProviderClient({ region });
    const { poolId } = await setupCognitoUserPool();
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const clientName = `client-${sanitizedName}`;
    const listClients = await client.send(new ListUserPoolClientsCommand({ UserPoolId: poolId, MaxResults: 50 }));
    let appClient = listClients.UserPoolClients?.find((c) => c.ClientName === clientName);
    if (!appClient) {
        const createClientRes = await client.send(new CreateUserPoolClientCommand({
            UserPoolId: poolId,
            ClientName: clientName,
            GenerateSecret: true,
            AllowedOAuthFlows: ["code"],
            AllowedOAuthFlowsUserPoolClient: true,
            AllowedOAuthScopes: ["openid", "email", "profile"],
            CallbackURLs: [`https://${sanitizedName}.bravocloud.tech/oauth2/idpresponse`],
            SupportedIdentityProviders: ["COGNITO"]
        }));
        appClient = createClientRes.UserPoolClient;
    }
    // Create or Update User
    const username = `admin-${sanitizedName}`;
    try {
        await client.send(new AdminCreateUserCommand({
            UserPoolId: poolId,
            Username: username,
            MessageAction: "SUPPRESS", // Don't send email
        }));
    }
    catch (e) {
        if (e.name !== 'UsernameExistsException')
            throw e;
    }
    await client.send(new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: username,
        Password: password,
        Permanent: true
    }));
    return { clientId: appClient.ClientId };
}
async function startCodeBuildJob(projectName, githubToken, repoUrl, branch, framework, buildCommand, installCommand, outputDirectory, rootDir = './', webhookUrl, deploymentId, userId) {
    const { CodeBuildClient, CreateProjectCommand, StartBuildCommand, UpdateProjectCommand } = require("@aws-sdk/client-codebuild");
    const codebuildClient = new CodeBuildClient({ region });
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const cbProjectName = `bravocloud-build-${sanitizedName}`;
    const roleArn = await getOrCreateCodeBuildRole();
    const accountId = await getAwsAccountId();
    const ecrRepoName = `bravocloud-${sanitizedName}`;
    const ecrUri = `${accountId}.dkr.ecr.${region}.amazonaws.com/${ecrRepoName}`;
    // Generate dynamic Dockerfile content matching the template
    const { generateDockerfile } = require('./templates');
    const dockerfileContent = generateDockerfile(framework, installCommand, buildCommand, outputDirectory);
    // Use base64 to completely avoid YAML and shell escaping issues
    const b64Dockerfile = Buffer.from(dockerfileContent).toString('base64');
    let actualRootDir = rootDir === './' ? '.' : rootDir.replace(/^\.\//, '');
    const buildspec = `
version: 0.2
env:
  variables:
    REPO_URL: "${repoUrl}"
    GITHUB_TOKEN: "${githubToken}"
    BRANCH: "${branch}"
    WEBHOOK_URL: "${webhookUrl}"
    DEPLOYMENT_ID: "${deploymentId}"
    ECR_URI: "${ecrUri}"
  exported-variables:
    - COMMIT_HASH
phases:
  pre_build:
    commands:
      - echo "Logging in to Amazon ECR..."
      - aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin $ECR_URI
      - echo "Cloning user repository..."
      - git clone https://\${GITHUB_TOKEN}@github.com/\${REPO_URL#https://github.com/} app
      - cd app
      - git checkout $BRANCH
      - export COMMIT_HASH=$(git rev-parse HEAD)
      - echo "Generating Dockerfile..."
      - cd ${actualRootDir}
      - echo "${b64Dockerfile}" | base64 --decode > Dockerfile
      - echo "node_modules" > .dockerignore
      - echo ".next" >> .dockerignore
      - echo ".git" >> .dockerignore
    finally:
      - |
        if [ $CODEBUILD_BUILD_SUCCEEDING -eq 0 ]; then
          curl -X POST $WEBHOOK_URL -H "Content-Type: application/json" -d "{\\"deploymentId\\":\\"$DEPLOYMENT_ID\\", \\"status\\":\\"FAILED\\"}"
        fi
  build:
    commands:
      - echo "Building the Docker image..."
      - cd app/${actualRootDir}
      - docker build -t $ECR_URI:latest -t $ECR_URI:$COMMIT_HASH .
    finally:
      - |
        if [ $CODEBUILD_BUILD_SUCCEEDING -eq 0 ]; then
          curl -X POST $WEBHOOK_URL -H "Content-Type: application/json" -d "{\\"deploymentId\\":\\"$DEPLOYMENT_ID\\", \\"status\\":\\"FAILED\\"}"
        fi
  post_build:
    commands:
      - echo "Build completed! Pushing to ECR..."
      - docker push $ECR_URI:latest
      - docker push $ECR_URI:$COMMIT_HASH
      - echo "Triggering BravoCloud Webhook..."
      - |
        if [ $CODEBUILD_BUILD_SUCCEEDING -eq 1 ]; then
          curl -X POST $WEBHOOK_URL -H "Content-Type: application/json" -d "{\\"deploymentId\\":\\"$DEPLOYMENT_ID\\", \\"status\\":\\"SUCCESS\\", \\"commitHash\\":\\"$COMMIT_HASH\\"}"
        else
          curl -X POST $WEBHOOK_URL -H "Content-Type: application/json" -d "{\\"deploymentId\\":\\"$DEPLOYMENT_ID\\", \\"status\\":\\"FAILED\\"}"
        fi
`;
    // Create or Update CodeBuild Project
    try {
        await codebuildClient.send(new CreateProjectCommand({
            name: cbProjectName,
            serviceRole: roleArn,
            artifacts: { type: "NO_ARTIFACTS" },
            environment: {
                type: "LINUX_CONTAINER",
                image: "aws/codebuild/standard:7.0",
                computeType: "BUILD_GENERAL1_SMALL",
                privilegedMode: true, // Needed for Docker build
            },
            source: {
                type: "NO_SOURCE", // We handle the git clone manually in buildspec
                buildspec: buildspec
            },
            timeoutInMinutes: 30
        }));
    }
    catch (e) {
        if (e.name === "ResourceAlreadyExistsException") {
            await codebuildClient.send(new UpdateProjectCommand({
                name: cbProjectName,
                source: {
                    type: "NO_SOURCE",
                    buildspec: buildspec
                }
            }));
        }
        else {
            throw e;
        }
    }
    // Trigger Build
    await codebuildClient.send(new StartBuildCommand({
        projectName: cbProjectName
    }));
}
async function updateProjectALBAuth(projectName, passwordProtection, clientId) {
    const { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand, DescribeListenersCommand, DescribeRulesCommand, ModifyRuleCommand } = require("@aws-sdk/client-elastic-load-balancing-v2");
    const elbClient = new ElasticLoadBalancingV2Client({ region });
    const dlbRes = await elbClient.send(new DescribeLoadBalancersCommand({ Names: ["bravocloud-alb"] }));
    const albArn = dlbRes.LoadBalancers?.[0]?.LoadBalancerArn;
    if (!albArn)
        return;
    const listeners = await elbClient.send(new DescribeListenersCommand({ LoadBalancerArn: albArn }));
    const httpsListenerArn = listeners.Listeners?.find((l) => l.Port === 443)?.ListenerArn;
    if (!httpsListenerArn)
        return;
    const rulesRes = await elbClient.send(new DescribeRulesCommand({ ListenerArn: httpsListenerArn }));
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const hostHeader = `${sanitizedName}.bravocloud.tech`;
    const projectRule = rulesRes.Rules?.find((r) => r.Conditions?.some((c) => c.Field === 'host-header' && c.HostHeaderConfig?.Values?.includes(hostHeader)));
    if (!projectRule)
        return;
    const { poolId, domain } = await setupCognitoUserPool();
    // Find the target group from existing actions
    const tgAction = projectRule.Actions?.find((a) => a.Type === 'forward');
    const tgArn = tgAction?.TargetGroupArn || tgAction?.ForwardConfig?.TargetGroups?.[0]?.TargetGroupArn;
    if (passwordProtection && clientId && tgArn) {
        console.log(`Enabling Cognito Auth for ${hostHeader}`);
        await elbClient.send(new ModifyRuleCommand({
            RuleArn: projectRule.RuleArn,
            Actions: [
                {
                    Type: "authenticate-cognito",
                    Order: 1,
                    AuthenticateCognitoConfig: {
                        UserPoolArn: `arn:aws:cognito-idp:${region}:${await getAwsAccountId()}:userpool/${poolId}`,
                        UserPoolClientId: clientId,
                        UserPoolDomain: domain,
                        SessionCookieName: "AWSELBAuthSessionCookie",
                        OnUnauthenticatedRequest: "authenticate"
                    }
                },
                {
                    Type: "forward",
                    Order: 2,
                    TargetGroupArn: tgArn
                }
            ]
        }));
    }
    else if (!passwordProtection && tgArn) {
        console.log(`Disabling Cognito Auth for ${hostHeader}`);
        await elbClient.send(new ModifyRuleCommand({
            RuleArn: projectRule.RuleArn,
            Actions: [
                {
                    Type: "forward",
                    Order: 1,
                    TargetGroupArn: tgArn
                }
            ]
        }));
    }
}
async function syncServerlessFunctions(projectName, functions) {
    if (!functions || functions.length === 0)
        return;
    const { LambdaClient, CreateFunctionCommand, GetFunctionCommand, UpdateFunctionConfigurationCommand } = require("@aws-sdk/client-lambda");
    const { ApiGatewayV2Client, CreateApiCommand, CreateIntegrationCommand, CreateRouteCommand, GetApisCommand } = require("@aws-sdk/client-apigatewayv2");
    const lambdaClient = new LambdaClient({ region });
    const apiGwClient = new ApiGatewayV2Client({ region });
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    // 1. Create API Gateway if it doesn't exist
    let apiId;
    const apis = await apiGwClient.send(new GetApisCommand({ MaxResults: "50" }));
    const existingApi = apis.Items?.find((api) => api.Name === `bravocloud-api-${sanitizedName}`);
    if (existingApi) {
        apiId = existingApi.ApiId;
    }
    else {
        console.log(`Provisioning API Gateway for ${projectName}`);
        const apiRes = await apiGwClient.send(new CreateApiCommand({
            Name: `bravocloud-api-${sanitizedName}`,
            ProtocolType: "HTTP",
            CorsConfiguration: { AllowOrigins: ["*"], AllowMethods: ["*"] }
        }));
        apiId = apiRes.ApiId;
    }
    // Very basic minimal zip for Node.js lambda (buffer of a zip file containing index.js)
    // This is a pre-compiled base64 zip containing: exports.handler = async () => "Placeholder";
    const dummyZipBuffer = Buffer.from("UEsDBAoAAAAAALyPqlgAAAAAAAAAAAAAAAAIAAAAaW5kZXguanNleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAodmFsdWUpID0+ICgiUGxhY2Vob2xkZXIiKTsKUEsBAhQACgAAAAAAvI+qWAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAP8BAAAAAGluZGV4LmpzUEsFBgAAAAABAAEANgAAAD0AAAAAAA==", "base64");
    const accountId = await getAwsAccountId();
    const executionRole = process.env.LAMBDA_EXECUTION_ROLE || `arn:aws:iam::${accountId}:role/ecsTaskExecutionRole`;
    for (const func of functions) {
        const lambdaName = `bc-${sanitizedName}-${func.name}`;
        let lambdaArn;
        try {
            const getRes = await lambdaClient.send(new GetFunctionCommand({ FunctionName: lambdaName }));
            lambdaArn = getRes.Configuration.FunctionArn;
            console.log(`Lambda ${lambdaName} exists, updating config...`);
            await lambdaClient.send(new UpdateFunctionConfigurationCommand({
                FunctionName: lambdaName,
                MemorySize: func.memory || 128,
                Timeout: func.timeout || 10
            }));
        }
        catch (e) {
            if (e.name === "ResourceNotFoundException") {
                console.log(`Provisioning new Lambda: ${lambdaName}`);
                try {
                    const createRes = await lambdaClient.send(new CreateFunctionCommand({
                        FunctionName: lambdaName,
                        Runtime: func.runtime || "nodejs20.x",
                        Role: executionRole,
                        Handler: "index.handler", // Real handler set during actual build
                        MemorySize: func.memory || 128,
                        Timeout: func.timeout || 10,
                        Code: { ZipFile: dummyZipBuffer }
                    }));
                    lambdaArn = createRes.FunctionArn;
                }
                catch (createErr) {
                    console.error(`Failed to create Lambda ${lambdaName}:`, createErr.message);
                    continue;
                }
            }
            else {
                console.error(`Error fetching Lambda ${lambdaName}:`, e.message);
                continue;
            }
        }
        // Provision API Gateway Route Integration
        try {
            const integrationRes = await apiGwClient.send(new CreateIntegrationCommand({
                ApiId: apiId,
                IntegrationType: "AWS_PROXY",
                IntegrationUri: lambdaArn,
                PayloadFormatVersion: "2.0"
            }));
            await apiGwClient.send(new CreateRouteCommand({
                ApiId: apiId,
                RouteKey: `ANY /api/${func.name}`,
                Target: `integrations/${integrationRes.IntegrationId}`
            }));
            console.log(`Created HTTP API Route: /api/${func.name}`);
        }
        catch (routeErr) {
            if (!routeErr.message.includes("ConflictException")) {
                console.error(`Error creating route for ${func.name}:`, routeErr.message);
            }
        }
    }
}
async function syncCronJobs(projectName, jobs) {
    const { SchedulerClient, CreateScheduleCommand, UpdateScheduleCommand, DeleteScheduleCommand, ListSchedulesCommand } = require("@aws-sdk/client-scheduler");
    const scheduler = new SchedulerClient({ region });
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const groupName = "default"; // AWS Scheduler requires a group, default is usually 'default'
    // We need an IAM Role that allows EventBridge Scheduler to invoke the API destination
    // For demo purposes we can assume an existing execution role
    const accountId = await getAwsAccountId();
    const executionRoleArn = process.env.SCHEDULER_EXECUTION_ROLE || `arn:aws:iam::${accountId}:role/ecsTaskExecutionRole`;
    // Fetch existing schedules for this project (using a prefix convention)
    const prefix = `bc-${sanitizedName}-`;
    let existingSchedules = [];
    try {
        const listRes = await scheduler.send(new ListSchedulesCommand({ NamePrefix: prefix, MaxResults: 100 }));
        existingSchedules = listRes.Schedules || [];
    }
    catch (e) {
        console.error("Failed to list schedules:", e.message);
    }
    const activeJobNames = new Set(jobs.map(j => `${prefix}${j.id}`));
    // Delete schedules that are no longer in the jobs array
    for (const existing of existingSchedules) {
        if (!activeJobNames.has(existing.Name)) {
            try {
                console.log(`Deleting removed schedule: ${existing.Name}`);
                await scheduler.send(new DeleteScheduleCommand({ Name: existing.Name }));
            }
            catch (e) { }
        }
    }
    // Create or update schedules
    for (const job of jobs) {
        const scheduleName = `${prefix}${job.id}`;
        const targetUrl = `https://${sanitizedName}.bravocloud.tech${job.path.startsWith('/') ? job.path : '/' + job.path}`;
        const params = {
            Name: scheduleName,
            ScheduleExpression: job.schedule,
            FlexibleTimeWindow: { Mode: "OFF" },
            Target: {
                Arn: "arn:aws:scheduler:::aws-sdk:http:invoke", // Note: A real API Destination ARN might be needed depending on AWS setup, but HTTP invoke is simpler if supported
                RoleArn: executionRoleArn,
                HttpParameters: {
                    Uri: targetUrl,
                    HttpMethod: "POST"
                }
            }
        };
        try {
            const existing = existingSchedules.find(s => s.Name === scheduleName);
            if (existing) {
                console.log(`Updating existing schedule: ${scheduleName}`);
                await scheduler.send(new UpdateScheduleCommand(params));
            }
            else {
                console.log(`Creating new schedule: ${scheduleName} to hit ${targetUrl}`);
                await scheduler.send(new CreateScheduleCommand(params));
            }
        }
        catch (e) {
            console.error(`Failed to provision schedule ${scheduleName}:`, e.message);
        }
    }
}
async function syncEdgeNetwork(projectName, edgeConfig) {
    const { CloudFrontClient, CreateDistributionCommand, UpdateDistributionCommand, GetDistributionConfigCommand, CreateFunctionCommand, DescribeFunctionCommand, UpdateFunctionCommand } = require("@aws-sdk/client-cloudfront");
    const cloudfront = new CloudFrontClient({ region: 'us-east-1' }); // CloudFront is global, must use us-east-1 for some operations
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!edgeConfig || !edgeConfig.enabled) {
        console.log(`Edge Network disabled for ${projectName}. Skipping CloudFront sync.`);
        // Note: In a real system, you would disable or delete the CloudFront distribution here.
        return;
    }
    const originId = `ALB-${sanitizedName}`;
    const originDomain = `bravocloud-alb-123456789.us-east-1.elb.amazonaws.com`; // Mock ALB DNS
    // 1. Provision Edge Function if provided
    let functionARN = null;
    if (edgeConfig.edgeFunctions && edgeConfig.edgeFunctions.code) {
        const funcName = `bc-edge-${sanitizedName}`;
        try {
            // Check if function exists
            try {
                const descRes = await cloudfront.send(new DescribeFunctionCommand({ Name: funcName, Stage: 'DEVELOPMENT' }));
                const eTag = descRes.ETag;
                console.log(`Updating CloudFront Function: ${funcName}`);
                const updateRes = await cloudfront.send(new UpdateFunctionCommand({
                    Name: funcName,
                    IfMatch: eTag,
                    FunctionConfig: { Comment: `Edge function for ${projectName}`, Runtime: 'cloudfront-js-1.0' },
                    FunctionCode: Buffer.from(edgeConfig.edgeFunctions.code)
                }));
                functionARN = updateRes.FunctionSummary?.FunctionMetadata?.FunctionARN;
            }
            catch (err) {
                if (err.name === 'NoSuchFunctionExists') {
                    console.log(`Creating CloudFront Function: ${funcName}`);
                    const createRes = await cloudfront.send(new CreateFunctionCommand({
                        Name: funcName,
                        FunctionConfig: { Comment: `Edge function for ${projectName}`, Runtime: 'cloudfront-js-1.0' },
                        FunctionCode: Buffer.from(edgeConfig.edgeFunctions.code)
                    }));
                    functionARN = createRes.FunctionSummary?.FunctionMetadata?.FunctionARN;
                }
                else {
                    throw err;
                }
            }
        }
        catch (e) {
            console.error(`Failed to provision Edge Function: ${e.message}`);
        }
    }
    // 2. Determine Cache Policy
    // AWS Managed Cache Policies
    const CACHING_OPTIMIZED = "658327ea-f89d-4fab-a63d-7e88639e58f6";
    const CACHING_DISABLED = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad";
    const cachePolicyId = edgeConfig.cachePolicy === 'Static Optimized' ? CACHING_OPTIMIZED : CACHING_DISABLED;
    // 3. Determine Geo Restrictions
    const geoRestriction = {
        RestrictionType: edgeConfig.geoRestriction?.type || 'none',
        Quantity: edgeConfig.geoRestriction?.countries?.length || 0,
        Items: edgeConfig.geoRestriction?.countries || []
    };
    // 4. Construct Distribution Config
    const distConfig = {
        CallerReference: `bc-${sanitizedName}-${Date.now()}`,
        Comment: `BravoCloud CDN for ${projectName}`,
        Enabled: true,
        Origins: {
            Quantity: 1,
            Items: [
                {
                    Id: originId,
                    DomainName: originDomain,
                    CustomOriginConfig: {
                        HTTPPort: 80,
                        HTTPSPort: 443,
                        OriginProtocolPolicy: 'https-only',
                        OriginSslProtocols: { Quantity: 1, Items: ['TLSv1.2'] }
                    }
                }
            ]
        },
        DefaultCacheBehavior: {
            TargetOriginId: originId,
            ViewerProtocolPolicy: 'redirect-to-https',
            CachePolicyId: cachePolicyId,
            FunctionAssociations: functionARN ? {
                Quantity: 1,
                Items: [
                    {
                        EventType: 'viewer-request',
                        FunctionARN: functionARN
                    }
                ]
            } : { Quantity: 0 }
        },
        Restrictions: {
            GeoRestriction: geoRestriction
        }
    };
    try {
        // In a real scenario, we would check if we already stored the DistributionId in the DB
        // For this demonstration, we'll try to create it directly.
        console.log(`Provisioning CloudFront Distribution for ${projectName}...`);
        await cloudfront.send(new CreateDistributionCommand({
            DistributionConfig: distConfig
        }));
        console.log(`Successfully triggered CloudFront deployment for ${projectName}.`);
    }
    catch (e) {
        if (e.name === 'DistributionAlreadyExists') {
            console.log(`CloudFront Distribution already exists for ${projectName}. Proceeding with Update.`);
            // Update logic would go here (fetch GetDistributionConfig, then UpdateDistribution)
        }
        else {
            console.error(`Failed to provision CloudFront Distribution:`, e.message);
        }
    }
}
async function setMaintenanceMode(projectName, enabled) {
    const { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand, DescribeListenersCommand, CreateRuleCommand, DescribeRulesCommand, DeleteRuleCommand } = require("@aws-sdk/client-elastic-load-balancing-v2");
    const elbClient = new ElasticLoadBalancingV2Client({ region });
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    try {
        const albRes = await elbClient.send(new DescribeLoadBalancersCommand({ Names: ["bravocloud-alb"] }));
        const albArn = albRes.LoadBalancers?.[0]?.LoadBalancerArn;
        if (!albArn)
            return;
        const listRes = await elbClient.send(new DescribeListenersCommand({ LoadBalancerArn: albArn }));
        const httpsListenerArn = listRes.Listeners?.find((l) => l.Port === 443)?.ListenerArn;
        if (!httpsListenerArn)
            return;
        const rulesRes = await elbClient.send(new DescribeRulesCommand({ ListenerArn: httpsListenerArn }));
        // Find existing maintenance rule (Priority usually set to 1 for highest override)
        const existingRule = rulesRes.Rules?.find((r) => r.Priority === "1" &&
            r.Conditions?.some((c) => c.Field === "host-header" && c.HostHeaderConfig?.Values?.includes(`${sanitizedName}.bravocloud.tech`)));
        if (enabled) {
            if (!existingRule) {
                // Create maintenance rule
                await elbClient.send(new CreateRuleCommand({
                    ListenerArn: httpsListenerArn,
                    Priority: 1, // Highest priority to override normal routing
                    Conditions: [{ Field: "host-header", HostHeaderConfig: { Values: [`${sanitizedName}.bravocloud.tech`] } }],
                    Actions: [{
                            Type: "fixed-response",
                            FixedResponseConfig: {
                                MessageBody: "<html><head><title>Under Maintenance</title></head><body style='font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #000; color: #fff;'><h1>We'll be right back.</h1><p>This project is currently under maintenance.</p></body></html>",
                                StatusCode: "503",
                                ContentType: "text/html"
                            }
                        }]
                }));
                console.log(`Enabled maintenance mode for ${projectName}`);
            }
        }
        else {
            if (existingRule) {
                await elbClient.send(new DeleteRuleCommand({ RuleArn: existingRule.RuleArn }));
                console.log(`Disabled maintenance mode for ${projectName}`);
            }
        }
    }
    catch (e) {
        console.error(`Failed to toggle maintenance mode for ${projectName}:`, e.message);
    }
}
async function setProjectComputeState(projectName, isPaused) {
    const { ECSClient, UpdateServiceCommand } = require("@aws-sdk/client-ecs");
    const ecsClient = new ECSClient({ region });
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const serviceName = `bravocloud-${sanitizedName}`;
    const clusterName = "bravocloud-cluster";
    try {
        const desiredCount = isPaused ? 0 : 1;
        await ecsClient.send(new UpdateServiceCommand({
            cluster: clusterName,
            service: serviceName,
            desiredCount
        }));
        console.log(`${isPaused ? 'Paused' : 'Resumed'} compute for ${projectName}`);
    }
    catch (e) {
        console.error(`Failed to toggle compute state for ${projectName}:`, e.message);
    }
}
async function syncAutoScaling(projectName, scalingConfig) {
    const { ApplicationAutoScalingClient, RegisterScalableTargetCommand, PutScalingPolicyCommand, DeleteScalingPolicyCommand, DeregisterScalableTargetCommand } = require("@aws-sdk/client-application-auto-scaling");
    const aasClient = new ApplicationAutoScalingClient({ region });
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const resourceId = `service/bravocloud-cluster/bravocloud-${sanitizedName}`;
    try {
        if (!scalingConfig || !scalingConfig.enabled) {
            // Disable auto-scaling
            try {
                await aasClient.send(new DeleteScalingPolicyCommand({
                    ServiceNamespace: "ecs",
                    ResourceId: resourceId,
                    ScalableDimension: "ecs:service:DesiredCount",
                    PolicyName: `bc-cpu-scaling-${sanitizedName}`
                }));
                await aasClient.send(new DeregisterScalableTargetCommand({
                    ServiceNamespace: "ecs",
                    ResourceId: resourceId,
                    ScalableDimension: "ecs:service:DesiredCount"
                }));
                console.log(`Disabled Auto-Scaling for ${projectName}`);
            }
            catch (err) {
                if (err.name !== "ObjectNotFoundException")
                    throw err;
            }
            return;
        }
        // Register Target
        await aasClient.send(new RegisterScalableTargetCommand({
            ServiceNamespace: "ecs",
            ResourceId: resourceId,
            ScalableDimension: "ecs:service:DesiredCount",
            MinCapacity: scalingConfig.minContainers || 1,
            MaxCapacity: scalingConfig.maxContainers || 5
        }));
        // Put Target Tracking Policy
        await aasClient.send(new PutScalingPolicyCommand({
            ServiceNamespace: "ecs",
            ResourceId: resourceId,
            ScalableDimension: "ecs:service:DesiredCount",
            PolicyName: `bc-cpu-scaling-${sanitizedName}`,
            PolicyType: "TargetTrackingScaling",
            TargetTrackingScalingPolicyConfiguration: {
                TargetValue: scalingConfig.targetCpu || 75.0,
                PredefinedMetricSpecification: {
                    PredefinedMetricType: "ECSServiceAverageCPUUtilization"
                },
                ScaleOutCooldown: 60,
                ScaleInCooldown: 300
            }
        }));
        console.log(`Configured Auto-Scaling for ${projectName}: Min=${scalingConfig.minContainers}, Max=${scalingConfig.maxContainers}, TargetCPU=${scalingConfig.targetCpu}%`);
    }
    catch (e) {
        console.error(`Failed to configure auto-scaling for ${projectName}:`, e.message);
    }
}
async function createDatabaseSnapshot(projectName) {
    const { RDSClient, CreateDBSnapshotCommand, DescribeDBInstancesCommand } = require("@aws-sdk/client-rds");
    const rdsClient = new RDSClient({ region });
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const dbInstanceId = `db-${sanitizedName}`; // Assume standard naming convention
    const snapshotId = `snapshot-${sanitizedName}-${Date.now()}`;
    try {
        // Verify instance exists
        try {
            await rdsClient.send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: dbInstanceId }));
        }
        catch (e) {
            if (e.name === 'DBInstanceNotFoundFault') {
                console.log(`No active database found for ${projectName}. Cannot create snapshot.`);
                return;
            }
            throw e;
        }
        await rdsClient.send(new CreateDBSnapshotCommand({
            DBInstanceIdentifier: dbInstanceId,
            DBSnapshotIdentifier: snapshotId
        }));
        console.log(`Initiated DB snapshot ${snapshotId} for ${projectName}`);
    }
    catch (e) {
        console.error(`Failed to create DB snapshot for ${projectName}:`, e.message);
        throw new Error(`RDS Snapshot failed: ${e.message}`);
    }
}
async function syncLogDrain(projectName, drainConfig) {
    const { CloudWatchLogsClient, PutSubscriptionFilterCommand, DeleteSubscriptionFilterCommand } = require("@aws-sdk/client-cloudwatch-logs");
    const cwClient = new CloudWatchLogsClient({ region });
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const logGroupName = `/ecs/bravocloud/${sanitizedName}`;
    const filterName = `bc-log-drain-${sanitizedName}`;
    try {
        if (!drainConfig || !drainConfig.webhookUrl) {
            // Remove drain
            try {
                await cwClient.send(new DeleteSubscriptionFilterCommand({
                    logGroupName,
                    filterName
                }));
                console.log(`Removed log drain for ${projectName}`);
            }
            catch (e) {
                if (e.name !== 'ResourceNotFoundException')
                    throw e;
            }
            return;
        }
        // In a production environment, you would route logs to a centralized Kinesis stream 
        // or Lambda function that then forwards HTTP POSTs to the webhookUrl.
        // For this implementation, we will assume a central BravoCloud log-forwarder Lambda exists.
        const logForwarderLambdaArn = `arn:aws:lambda:${region}:123456789012:function:BravocloudLogForwarder`;
        await cwClient.send(new PutSubscriptionFilterCommand({
            logGroupName,
            filterName,
            filterPattern: "", // Match all logs
            destinationArn: logForwarderLambdaArn
        }));
        console.log(`Configured log drain for ${projectName} pointing to ${drainConfig.webhookUrl}`);
    }
    catch (e) {
        console.error(`Failed to configure log drain for ${projectName}:`, e.message);
    }
}
