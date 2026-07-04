"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebase_1 = require("../lib/firebase");
const aws_1 = require("../lib/aws");
const alerts_1 = require("../lib/alerts");
const middleware_1 = require("../lib/middleware");
const router = (0, express_1.Router)();
// Get all deployments across all projects for the authenticated user
router.get('/', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        // 1. Get all projects owned by the user
        const projectsSnapshot = await firebase_1.db.collection('projects')
            .where('userId', '==', userId)
            .get();
        if (projectsSnapshot.empty) {
            return res.json({ deployments: [] });
        }
        const projects = {};
        projectsSnapshot.forEach(doc => {
            projects[doc.id] = { id: doc.id, ...doc.data() };
        });
        const projectIds = Object.keys(projects);
        // 2. Fetch deployments for these projects
        // Firestore 'in' query is limited to 10 items, so we fetch in chunks or individually
        const deployments = [];
        // For scalability without hitting the 10-item 'in' limit, we'll fetch them individually per project
        // Note: In a massive production system, we'd add userId to deployments directly to avoid this.
        const fetchPromises = projectIds.map(async (projectId) => {
            const depsSnap = await firebase_1.db.collection('deployments')
                .where('projectId', '==', projectId)
                .get();
            depsSnap.forEach(doc => {
                const depData = doc.data();
                deployments.push({
                    id: doc.id,
                    ...depData,
                    projectName: projects[projectId].name // Attach project name for UI
                });
            });
        });
        await Promise.all(fetchPromises);
        // Sort all deployments globally by createdAt desc
        deployments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        // Return the top 50 global deployments
        res.json({ deployments: deployments.slice(0, 50) });
    }
    catch (error) {
        console.error('Error fetching global deployments:', error);
        res.status(500).json({ error: 'Failed to fetch deployments' });
    }
});
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
        // If the build succeeded, push to App Runner/ECS
        const actualProjectId = projectId || (updatedDeployment && updatedDeployment.projectId);
        if (actualProjectId) {
            const projectRef = firebase_1.db.collection('projects').doc(actualProjectId);
            const projectDoc = await projectRef.get();
            if (projectDoc.exists) {
                const project = projectDoc.data();
                // Trigger alerts and Webhooks
                if (status === 'SUCCESS') {
                    (0, alerts_1.triggerAlert)(project.userId, 'deployment_success', { projectName: project.name, deploymentId, url: `https://${project.name}-custom-url.bravocloud.io` });
                    const { fireProjectWebhooks } = require('../lib/webhooks');
                    fireProjectWebhooks(actualProjectId, 'deployment.success', { projectName: project.name, deploymentId, status: 'SUCCESS' });
                }
                else if (status === 'FAILED') {
                    (0, alerts_1.triggerAlert)(project.userId, 'deployment_failed', { projectName: project.name, deploymentId, error: 'AWS CodeBuild deployment failed' });
                    const { fireProjectWebhooks } = require('../lib/webhooks');
                    fireProjectWebhooks(actualProjectId, 'deployment.failed', { projectName: project.name, deploymentId, status: 'FAILED' });
                }
                if (status === 'SUCCESS') {
                    try {
                        const ecrRepoName = `bravocloud-${project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
                        const region = process.env.AWS_REGION || "us-east-1";
                        const accountId = await (0, aws_1.getAwsAccountId)();
                        const imageUri = `${accountId}.dkr.ecr.${region}.amazonaws.com/${ecrRepoName}:latest`;
                        const envs = project.envVars ? project.envVars : undefined;
                        const framework = (project.framework || "").toLowerCase();
                        let targetPort = "3000";
                        if (framework.includes("react") || framework.includes("vite") || framework.includes("vue") || framework.includes("svelte") || framework.includes("angular")) {
                            targetPort = "80";
                        }
                        else if (framework.includes("python") || framework.includes("django") || framework.includes("flask") || framework.includes("fastapi")) {
                            targetPort = "8000";
                        }
                        const ecsUrl = await (0, aws_1.deployToECS)(project.name, imageUri, envs, targetPort);
                        console.log(`[Webhook] ECS Fargate Deployed! Live URL: ${ecsUrl}`);
                        // Wait briefly for the new task to stabilize, then get its IP
                        await new Promise(r => setTimeout(r, 10000));
                        const { getEcsTaskPublicIp } = require('../lib/aws');
                        const taskIp = await getEcsTaskPublicIp(project.name);
                        // Store the live URL and new IP on the project document
                        const updatePayload = { port: parseInt(targetPort) };
                        if (ecsUrl) {
                            updatePayload.subdomain = ecsUrl.replace('http://', '').replace('https://', '').split('/')[0];
                        }
                        if (taskIp) {
                            updatePayload.taskIp = taskIp;
                        }
                        if (Object.keys(updatePayload).length > 0) {
                            await projectRef.update(updatePayload);
                        }
                        // Execute deferred Agent Transfer teardown
                        if (project.pendingTransferFrom) {
                            if (project.pendingTransferFrom !== 'aws') {
                                const killJob = {
                                    agentId: project.pendingTransferFrom,
                                    projectId: actualProjectId,
                                    action: 'KILL',
                                    status: 'Pending',
                                    createdAt: new Date().toISOString()
                                };
                                await firebase_1.db.collection('users').doc(project.userId).collection('agent_jobs').add(killJob);
                                console.log(`[Webhook] Deferred KILL job sent to local agent ${project.pendingTransferFrom}`);
                            }
                            const admin = require('firebase-admin');
                            await projectRef.update({
                                pendingTransferFrom: admin.firestore.FieldValue.delete()
                            });
                        }
                    }
                    catch (ecsErr) {
                        console.error('[Webhook] Failed to deploy to ECS:', ecsErr);
                    }
                } // closes if status === 'SUCCESS'
            } // closes if projectDoc.exists
        } // closes if actualProjectId
        console.log(`[Webhook] Deployment ${deploymentId} updated to ${status}`);
        res.json({ success: true, deployment: updatedDeployment });
    }
    catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
exports.default = router;
