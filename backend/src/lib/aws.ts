import { ECRClient, CreateRepositoryCommand, DescribeRepositoriesCommand } from "@aws-sdk/client-ecr";
import { AppRunnerClient, CreateServiceCommand } from "@aws-sdk/client-apprunner";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { IAMClient, GetRoleCommand, CreateRoleCommand, AttachRolePolicyCommand } from "@aws-sdk/client-iam";

const region = process.env.AWS_REGION || "us-east-1";

// Ensure AWS credentials are set in .env
const ecrClient = new ECRClient({ region });
const appRunnerClient = new AppRunnerClient({ region });
const stsClient = new STSClient({ region });
const iamClient = new IAMClient({ region });

export async function getAwsAccountId(): Promise<string> {
  const response = await stsClient.send(new GetCallerIdentityCommand({}));
  return response.Account || "";
}

async function getOrCreateAppRunnerRole(): Promise<string> {
  const roleName = "AppRunnerECRAccessRole";
  
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
          Service: ["build.apprunner.amazonaws.com", "tasks.apprunner.amazonaws.com"]
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
    PolicyArn: "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
  }));

  // Wait for IAM propagation
  await new Promise(resolve => setTimeout(resolve, 10000));

  return roleArn || "";
}

/**
 * Creates an ECR repository if it doesn't exist and returns its URI.
 */
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

/**
 * Creates an AWS App Runner service for the given image URI.
 * Note: Assumes an IAM role "AppRunnerECRAccessRole" exists in the account.
 */
export async function deployToAppRunner(projectName: string, imageUri: string, envVars?: Record<string, string>, port: string = "3000"): Promise<string> {
  const serviceName = `bravocloud-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;

  const imageConfig: any = { Port: port };
  if (envVars && Object.keys(envVars).length > 0) {
    imageConfig.RuntimeEnvironmentVariables = envVars;
  }

  const roleArn = await getOrCreateAppRunnerRole();

  const createServiceCmd = new CreateServiceCommand({
    ServiceName: serviceName,
    SourceConfiguration: {
      AuthenticationConfiguration: {
        AccessRoleArn: roleArn
      },
      ImageRepository: {
        ImageIdentifier: imageUri,
        ImageRepositoryType: "ECR",
        ImageConfiguration: imageConfig
      },
      AutoDeploymentsEnabled: true
    },
    InstanceConfiguration: {
      Cpu: "1 vCPU",
      Memory: "2 GB"
    }
  });

  const response = await appRunnerClient.send(createServiceCmd);
  
  if (!response.Service?.ServiceUrl) {
      throw new Error("Failed to deploy to App Runner");
  }

  return `https://${response.Service.ServiceUrl}`;
}
