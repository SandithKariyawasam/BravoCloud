import { ECRClient, CreateRepositoryCommand, DescribeRepositoriesCommand } from "@aws-sdk/client-ecr";
import { AppRunnerClient, CreateServiceCommand } from "@aws-sdk/client-apprunner";

const region = process.env.AWS_REGION || "us-east-1";

// Ensure AWS credentials are set in .env
const ecrClient = new ECRClient({ region });
const appRunnerClient = new AppRunnerClient({ region });

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

  // This is a simplified deployment command. In a real environment, 
  // you must provide the accessRoleArn that grants App Runner permission to pull from ECR.
  const createServiceCmd = new CreateServiceCommand({
    ServiceName: serviceName,
    SourceConfiguration: {
      AuthenticationConfiguration: {
        // You would typically query AWS IAM for this Role ARN
        // AccessRoleArn: "arn:aws:iam::123456789012:role/AppRunnerECRAccessRole"
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
