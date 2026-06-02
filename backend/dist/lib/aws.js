"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAwsAccountId = getAwsAccountId;
exports.createEcrRepository = createEcrRepository;
exports.deployToAppRunner = deployToAppRunner;
const client_ecr_1 = require("@aws-sdk/client-ecr");
const client_apprunner_1 = require("@aws-sdk/client-apprunner");
const client_sts_1 = require("@aws-sdk/client-sts");
const client_iam_1 = require("@aws-sdk/client-iam");
const region = process.env.AWS_REGION || "us-east-1";
// Ensure AWS credentials are set in .env
const ecrClient = new client_ecr_1.ECRClient({ region });
const appRunnerClient = new client_apprunner_1.AppRunnerClient({ region });
const stsClient = new client_sts_1.STSClient({ region });
const iamClient = new client_iam_1.IAMClient({ region });
async function getAwsAccountId() {
    const response = await stsClient.send(new client_sts_1.GetCallerIdentityCommand({}));
    return response.Account || "";
}
async function getOrCreateAppRunnerRole() {
    const roleName = "AppRunnerECRAccessRole";
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
                    Service: ["build.apprunner.amazonaws.com", "tasks.apprunner.amazonaws.com"]
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
        PolicyArn: "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
    }));
    // Wait for IAM propagation
    await new Promise(resolve => setTimeout(resolve, 10000));
    return roleArn || "";
}
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
    const roleArn = await getOrCreateAppRunnerRole();
    const createServiceCmd = new client_apprunner_1.CreateServiceCommand({
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
