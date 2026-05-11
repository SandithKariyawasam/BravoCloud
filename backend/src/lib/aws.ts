import { ECRClient, CreateRepositoryCommand, DescribeRepositoriesCommand } from "@aws-sdk/client-ecr";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { IAMClient, GetRoleCommand, CreateRoleCommand, AttachRolePolicyCommand } from "@aws-sdk/client-iam";
import { EC2Client, DescribeVpcsCommand, DescribeSubnetsCommand, CreateSecurityGroupCommand, AuthorizeSecurityGroupIngressCommand, DescribeSecurityGroupsCommand, DescribeNetworkInterfacesCommand } from "@aws-sdk/client-ec2";
import { ECSClient, CreateClusterCommand, RegisterTaskDefinitionCommand, CreateServiceCommand, ListTasksCommand, DescribeTasksCommand, UpdateServiceCommand } from "@aws-sdk/client-ecs";

import { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand, DescribeListenersCommand, CreateTargetGroupCommand, CreateRuleCommand, DescribeTargetGroupsCommand } from "@aws-sdk/client-elastic-load-balancing-v2";

const region = process.env.AWS_REGION || "us-east-1";

// Ensure AWS credentials are set in .env
const ecrClient = new ECRClient({ region });
const stsClient = new STSClient({ region });
const iamClient = new IAMClient({ region });
const ec2Client = new EC2Client({ region });
const ecsClient = new ECSClient({ region });

export async function getAwsAccountId(): Promise<string> {
  const response = await stsClient.send(new GetCallerIdentityCommand({}));
  return response.Account || "";
}

async function getOrCreateEcsExecutionRole(): Promise<string> {
  const roleName = "ecsTaskExecutionRole";
  
  try {
    const roleResponse = await iamClient.send(new GetRoleCommand({ RoleName: roleName }));
    return roleResponse.Role?.Arn || "";
  } catch (error: any) {
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

  const createRoleRes = await iamClient.send(new CreateRoleCommand({
    RoleName: roleName,
    AssumeRolePolicyDocument: JSON.stringify(trustPolicy)
  }));

  const roleArn = createRoleRes.Role?.Arn;

  await iamClient.send(new AttachRolePolicyCommand({
    RoleName: roleName,
    PolicyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
  }));

  // Wait for IAM propagation
  await new Promise(resolve => setTimeout(resolve, 10000));

  return roleArn || "";
}

export async function createEcrRepository(projectName: string): Promise<string> {
  const repoName = `bravocloud-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;

  try {
    // Check if it exists
    const describeCmd = new DescribeRepositoriesCommand({ repositoryNames: [repoName] });
    const response = await ecrClient.send(describeCmd);
    
    if (response.repositories && response.repositories.length > 0 && response.repositories[0].repositoryUri) {
        return response.repositories[0].repositoryUri;
    }
  } catch (error: any) {
    if (error.name !== "RepositoryNotFoundException") {
      throw error;
    }
  }

  // Create if it doesn't exist
  const createCmd = new CreateRepositoryCommand({
    repositoryName: repoName,
    imageScanningConfiguration: { scanOnPush: true }
  });

  const createResponse = await ecrClient.send(createCmd);
  
  if (!createResponse.repository?.repositoryUri) {
      throw new Error("Failed to create ECR repository");
  }

  return createResponse.repository.repositoryUri;
}

async function getNetworkConfiguration(port: string) {
  // 1. Get Default VPC
  const vpcRes = await ec2Client.send(new DescribeVpcsCommand({
    Filters: [{ Name: "isDefault", Values: ["true"] }]
  }));
  const vpcId = vpcRes.Vpcs?.[0]?.VpcId;
  if (!vpcId) throw new Error("No default VPC found");

  // 2. Get Subnets for VPC
  const subnetRes = await ec2Client.send(new DescribeSubnetsCommand({
    Filters: [{ Name: "vpc-id", Values: [vpcId] }]
  }));
  const subnets = subnetRes.Subnets?.map(s => s.SubnetId as string) || [];
  if (subnets.length === 0) throw new Error("No subnets found in default VPC");

  // 3. Create or get Security Group
  const sgName = `bravocloud-ecs-sg-${port}`;
  let sgId = "";
  try {
    const createSgRes = await ec2Client.send(new CreateSecurityGroupCommand({
      GroupName: sgName,
      Description: `Allow inbound traffic on port ${port} for BravoCloud ECS`,
      VpcId: vpcId
    }));
    sgId = createSgRes.GroupId as string;

    // Add Ingress rule
    await ec2Client.send(new AuthorizeSecurityGroupIngressCommand({
      GroupId: sgId,
      IpPermissions: [{
        IpProtocol: "tcp",
        FromPort: parseInt(port),
        ToPort: parseInt(port),
        IpRanges: [{ CidrIp: "0.0.0.0/0" }]
      }]
    }));
  } catch (error: any) {
    if (error.name === "InvalidGroup.Duplicate") {
      const descSgRes = await ec2Client.send(new DescribeSecurityGroupsCommand({
        GroupNames: [sgName]
      }));
      sgId = descSgRes.SecurityGroups?.[0]?.GroupId as string;
    } else {
      throw error;
    }
  }

  return { subnets, sgId };
}

export async function deployToECS(projectName: string, imageUri: string, envVars?: Record<string, string>, port: string = "3000"): Promise<string> {
  const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const clusterName = `bravocloud-cluster`;
  const familyName = `bravocloud-task-${sanitizedName}`;

  // 1. Create/Ensure Cluster
  await ecsClient.send(new CreateClusterCommand({ clusterName }));

  // 2. Get Execution Role
  const executionRoleArn = await getOrCreateEcsExecutionRole();

  // 3. Register Task Definition
  const environment = envVars ? Object.entries(envVars).map(([name, value]) => ({ name, value })) : [];
  
  const taskDefRes = await ecsClient.send(new RegisterTaskDefinitionCommand({
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
  if (!taskDefArn) throw new Error("Failed to register task definition");

  // 4. Get Network Config
  const { subnets, sgId } = await getNetworkConfiguration(port);

  const serviceName = `bravocloud-service-${sanitizedName}`;

  // 5. Setup Load Balancer Routing
  const elbClient = new ElasticLoadBalancingV2Client({ region });
  const albRes = await elbClient.send(new DescribeLoadBalancersCommand({ Names: ["bravocloud-alb"] }));
  const albArn = albRes.LoadBalancers?.[0]?.LoadBalancerArn;
  const albVpcId = albRes.LoadBalancers?.[0]?.VpcId;
  
  if (!albArn || !albVpcId) throw new Error("ALB not found");

  const listRes = await elbClient.send(new DescribeListenersCommand({ LoadBalancerArn: albArn }));
  const httpsListenerArn = listRes.Listeners?.find(l => l.Port === 443)?.ListenerArn;
  if (!httpsListenerArn) throw new Error("HTTPS Listener not found");

  // Create Target Group for this project
  const tgName = `bravocloud-tg-${sanitizedName}`.substring(0, 32); // Max 32 chars
  let tgArn = "";
  try {
    const tgRes = await elbClient.send(new CreateTargetGroupCommand({
      Name: tgName,
      Protocol: "HTTP",
      Port: parseInt(port),
      VpcId: albVpcId,
      TargetType: "ip",
      HealthCheckPath: "/",
      HealthCheckIntervalSeconds: 60
    }));
    tgArn = tgRes.TargetGroups?.[0]?.TargetGroupArn || "";
  } catch (e: any) {
    if (e.name === "DuplicateTargetGroupNameException" || e.name === "DuplicateTargetGroupName") {
      const descRes = await elbClient.send(new DescribeTargetGroupsCommand({ Names: [tgName] }));
      tgArn = descRes.TargetGroups?.[0]?.TargetGroupArn || "";
    } else {
      console.error("Target Group creation failed", e);
      throw e;
    }
  }

  // Create Listener Rule for Host Routing
  try {
    // Attempt to create the rule. Note: in a real production system, you would check if it exists first.
    const priority = Math.floor(Math.random() * 49999) + 1;
    await elbClient.send(new CreateRuleCommand({
      ListenerArn: httpsListenerArn,
      Conditions: [{ Field: "host-header", HostHeaderConfig: { Values: [`${sanitizedName}.bravocloud.tech`] } }],
      Priority: priority,
      Actions: [{ Type: "forward", TargetGroupArn: tgArn }]
    }));
  } catch (ruleErr) {
    // If priority is taken or rule exists, ignore for now as it routes to the correct TG
    console.log("Rule might already exist, proceeding...");
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
    await ecsClient.send(new CreateServiceCommand(createServiceInput as any));
  } catch (err: any) {
    if (err.name === "InvalidParameterException" && err.message.includes("Creation of service was not idempotent")) {
        // AWS ECS does NOT allow adding a Load Balancer to an existing service that didn't have one!
        // We must delete the old service and recreate it.
        const { DeleteServiceCommand } = require("@aws-sdk/client-ecs");
        console.log("Service exists but needs Load Balancer attachment. Recreating service...");
        await ecsClient.send(new DeleteServiceCommand({ cluster: clusterName, service: serviceName, force: true }));
        
        // Wait a moment for deletion to propagate
        await new Promise(r => setTimeout(r, 5000));

        // Create it again with the Load Balancer!
        await ecsClient.send(new CreateServiceCommand(createServiceInput as any));
    } else {
        throw err;
    }
  }

  return `https://${sanitizedName}.bravocloud.tech`;
}
