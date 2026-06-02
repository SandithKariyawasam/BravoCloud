"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEcrRepository = createEcrRepository;
exports.deployToAppRunner = deployToAppRunner;
const client_ecr_1 = require("@aws-sdk/client-ecr");
const client_apprunner_1 = require("@aws-sdk/client-apprunner");
const region = process.env.AWS_REGION || "us-east-1";
// Ensure AWS credentials are set in .env
const ecrClient = new client_ecr_1.ECRClient({ region });
const appRunnerClient = new client_apprunner_1.AppRunnerClient({ region });
/**
 * Creates an ECR repository if it doesn't exist and returns its URI.
 */
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
/**
 * Creates an AWS App Runner service for the given image URI.
 * Note: Assumes an IAM role "AppRunnerECRAccessRole" exists in the account.
 */
async function deployToAppRunner(projectName, imageUri, envVars, port = "3000") {
    const serviceName = `bravocloud-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    const imageConfig = { Port: port };
    if (envVars && Object.keys(envVars).length > 0) {
        imageConfig.RuntimeEnvironmentVariables = envVars;
    }
    // This is a simplified deployment command. In a real environment, 
    // you must provide the accessRoleArn that grants App Runner permission to pull from ECR.
    const createServiceCmd = new client_apprunner_1.CreateServiceCommand({
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
