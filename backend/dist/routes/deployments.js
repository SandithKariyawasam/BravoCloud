"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebase_1 = require("../lib/firebase");
const aws_1 = require("../lib/aws");
const router = (0, express_1.Router)();
// Webhook for GitHub Actions to update deployment status
router.post('/webhook', async (req, res) => {
    try {
        const { projectId, deploymentId, status, commitHash } = req.body;
        if (!deploymentId || !status) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const deploymentRef = firebase_1.db.collection('deployments').doc(deploymentId);
        const updateData = { status };
        if (commitHash)
            updateData.commitHash = commitHash;
        await deploymentRef.update(updateData);
        const updatedDoc = await deploymentRef.get();
        const updatedDeployment = updatedDoc.data();
        // If the build succeeded, push to App Runner
        if (status === 'SUCCESS' && projectId) {
            const projectRef = firebase_1.db.collection('projects').doc(projectId);
            const projectDoc = await projectRef.get();
            if (projectDoc.exists) {
                const project = projectDoc.data();
                try {
                    const ecrRepoName = `bravocloud-${project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
                    // Generate the expected ECR URI format to pass to App Runner
                    // In production, you would fetch this using DescribeRepositories or pass it in the webhook
                    const region = process.env.AWS_REGION || "us-east-1";
                    const accountId = process.env.AWS_ACCOUNT_ID || "123456789012";
                    const imageUri = `${accountId}.dkr.ecr.${region}.amazonaws.com/${ecrRepoName}:latest`;
                    const envs = project.envVars ? project.envVars : undefined;
                    const appRunnerUrl = await (0, aws_1.deployToAppRunner)(project.name, imageUri, envs);
                    console.log(`[Webhook] App Runner Deployed! Live URL: ${appRunnerUrl}`);
                    // Store the live URL on the project document
                    if (appRunnerUrl) {
                        await projectRef.update({
                            subdomain: appRunnerUrl.replace('https://', '').split('/')[0]
                        });
                    }
                }
                catch (appRunnerErr) {
                    console.error('[Webhook] Failed to deploy to App Runner:', appRunnerErr);
                }
            }
        }
        console.log(`[Webhook] Deployment ${deploymentId} updated to ${status}`);
        res.json({ success: true, deployment: updatedDeployment });
    }
    catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
exports.default = router;
