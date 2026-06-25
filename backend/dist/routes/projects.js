"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebase_1 = require("../lib/firebase");
const aws_1 = require("../lib/aws");
const middleware_1 = require("../lib/middleware");
// @ts-ignore
const node_fetch_1 = __importDefault(require("node-fetch"));
const router = (0, express_1.Router)();
const fetchApi = typeof node_fetch_1.default !== 'undefined' ? node_fetch_1.default : require('node-fetch');
// Create a new project
router.post('/', middleware_1.verifyToken, async (req, res) => {
    try {
        const { name, repoUrl, framework, branch = "main", rootDir = "./", buildCommand, outputDirectory, installCommand, envVars, agentId } = req.body;
        const userId = req.user.id; // DB ID from session
        if (!name || !repoUrl || !framework) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Parse repo URL to get owner and repo name
        const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
        const repoOwner = urlParts[0];
        const repoName = urlParts[1];
        if (!repoOwner || !repoName) {
            return res.status(400).json({ error: 'Invalid GitHub repository URL' });
        }
        // Fetch user to get their GitHub Token
        const userDoc = await firebase_1.db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(400).json({ error: 'User not found. Please log in again.' });
        }
        const user = userDoc.data();
        if (!user || !user.githubToken) {
            return res.status(400).json({ error: 'GitHub token not found. Please log in again.' });
        }
        // Generate a simple subdomain based on project name
        const baseSubdomain = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        let subdomain = baseSubdomain;
        let counter = 1;
        // Ensure subdomain is unique
        while (true) {
            const existing = await firebase_1.db.collection('projects').where('subdomain', '==', subdomain).limit(1).get();
            if (existing.empty)
                break;
            subdomain = `${baseSubdomain}-${counter}`;
            counter++;
        }
        const projectRef = firebase_1.db.collection('projects').doc();
        const projectData = {
            id: projectRef.id,
            name,
            repoUrl,
            framework,
            branch,
            rootDir,
            buildCommand: buildCommand || null,
            outputDirectory: outputDirectory || null,
            installCommand: installCommand || null,
            envVars: envVars || null,
            subdomain,
            userId,
            agentId: agentId || null,
            createdAt: new Date().toISOString()
        };
        await projectRef.set(projectData);
        // Create initial deployment
        const deploymentRef = firebase_1.db.collection('deployments').doc();
        const deploymentData = {
            id: deploymentRef.id,
            projectId: projectRef.id,
            status: 'QUEUED',
            commitHash: 'initial-commit',
            createdAt: new Date().toISOString()
        };
        await deploymentRef.set(deploymentData);
        if (agentId) {
            // Route deployment to self-hosted agent
            const newJob = {
                agentId,
                repository: projectData.repoUrl,
                deploymentId: deploymentRef.id,
                projectId: projectRef.id,
                projectName: projectData.name,
                rootDir: projectData.rootDir,
                installCommand: projectData.installCommand,
                buildCommand: projectData.buildCommand,
                status: 'Pending',
                createdAt: new Date().toISOString()
            };
            await firebase_1.db.collection('users').doc(userId).collection('agent_jobs').add(newJob);
            // We skip AWS provisioning completely for self-hosted agents
            return res.status(201).json({ success: true, project: projectData, deployment: deploymentData });
        }
        let ecrUri = '';
        try {
            ecrUri = await (0, aws_1.createEcrRepository)(projectData.name, userId);
        }
        catch (awsError) {
            console.error('Failed to create AWS ECR Repository:', awsError);
            return res.status(500).json({ error: 'Failed to provision AWS infrastructure' });
        }
        // Generate files
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers.host;
        const dynamicBackendUrl = `${protocol}://${host}`;
        const webhookUrl = `${process.env.BACKEND_URL || dynamicBackendUrl}/api/deployments/webhook`;
        let finalDeploymentData = { ...deploymentData };
        try {
            const { startCodeBuildJob } = require('../lib/aws');
            await startCodeBuildJob(projectData.name, user.githubToken, projectData.repoUrl, projectData.branch || 'main', projectData.framework, projectData.buildCommand, projectData.installCommand, projectData.outputDirectory, projectData.rootDir, webhookUrl, deploymentRef.id, userId);
            finalDeploymentData.status = 'BUILDING';
            // We don't have a commit hash yet, but we can set it later if needed or leave it as initial-commit
            await deploymentRef.update({ status: 'BUILDING' });
        }
        catch (awsError) {
            console.error('Failed to trigger CodeBuild:', awsError);
            finalDeploymentData.status = 'FAILED';
            await deploymentRef.update({ status: 'FAILED' });
            return res.status(201).json({
                success: true,
                project: projectData,
                deployment: finalDeploymentData,
                warning: `Project created but failed to start build process: ${awsError.message || awsError.toString()}`
            });
        }
        res.status(201).json({ success: true, project: projectData, deployment: finalDeploymentData });
    }
    catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});
// Get user's projects
router.get('/', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const projectsSnapshot = await firebase_1.db.collection('projects')
            .where('userId', '==', userId)
            .get();
        let projects = projectsSnapshot.docs.map(doc => doc.data());
        // In-memory sort to avoid requiring a composite index setup on Firebase
        projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        for (const project of projects) {
            // Fetch latest deployment
            const depsSnapshot = await firebase_1.db.collection('deployments')
                .where('projectId', '==', project.id)
                .get();
            let deployments = depsSnapshot.docs.map(d => d.data());
            deployments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            project.deployments = deployments.slice(0, 1);
        }
        res.json({ projects });
    }
    catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});
// Proxy Favicon for dashboard cards (bypasses Mixed Content and parses HTML for correct icon)
router.get('/proxy-favicon', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl)
        return res.status(400).send('Missing url');
    try {
        const htmlRes = await fetchApi(targetUrl);
        if (!htmlRes.ok)
            return res.status(404).send('Site not responding');
        const html = await htmlRes.text();
        let faviconUrl = '';
        // Find <link rel="icon" ...> or <link rel="shortcut icon" ...>
        const linkRegex = /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["'][^>]*>/i;
        const linkRegex2 = /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["'][^>]*>/i;
        let match = html.match(linkRegex);
        if (match) {
            faviconUrl = match[1];
        }
        else {
            match = html.match(linkRegex2);
            if (match) {
                faviconUrl = match[1];
            }
        }
        if (!faviconUrl) {
            faviconUrl = '/favicon.ico';
        }
        // Resolve relative URLs
        let finalFaviconUrl = faviconUrl;
        if (faviconUrl.startsWith('/')) {
            const baseUrl = new URL(targetUrl);
            finalFaviconUrl = `${baseUrl.origin}${faviconUrl}`;
        }
        else if (!faviconUrl.startsWith('http')) {
            finalFaviconUrl = `${targetUrl.replace(/\/$/, '')}/${faviconUrl}`;
        }
        const imageRes = await fetchApi(finalFaviconUrl);
        if (!imageRes.ok)
            return res.status(404).send('Favicon not found');
        const contentType = imageRes.headers.get('content-type') || 'image/x-icon';
        res.setHeader('Content-Type', contentType);
        const arrayBuffer = await imageRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);
    }
    catch (error) {
        console.error('Failed to proxy favicon:', error);
        res.status(500).send('Failed to fetch favicon');
    }
});
// Get a single project
router.get('/:id', middleware_1.verifyToken, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.id;
        const projectDoc = await firebase_1.db.collection('projects').doc(projectId).get();
        if (!projectDoc.exists) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const project = projectDoc.data();
        if (project.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const { getEcsTaskPublicIp } = require('../lib/aws');
        let taskIp = null;
        if (!project.agentId) {
            taskIp = await getEcsTaskPublicIp(project.name);
        }
        if (project.storage && project.storage.length > 0) {
            let updatedStorage = false;
            const { RDSClient, DescribeDBInstancesCommand } = require("@aws-sdk/client-rds");
            const { ElastiCacheClient, DescribeCacheClustersCommand } = require("@aws-sdk/client-elasticache");
            const region = process.env.AWS_REGION || 'us-east-1';
            for (const item of project.storage) {
                if (item.status === 'Provisioning') {
                    try {
                        if (item.type === 'postgres') {
                            const rdsClient = new RDSClient({ region });
                            const res = await rdsClient.send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: item.id }));
                            if (res.DBInstances && res.DBInstances.length > 0 && res.DBInstances[0].DBInstanceStatus === 'available') {
                                item.status = 'Active';
                                updatedStorage = true;
                            }
                        }
                        else if (item.type === 'redis') {
                            const cacheClient = new ElastiCacheClient({ region });
                            const res = await cacheClient.send(new DescribeCacheClustersCommand({ CacheClusterId: item.id }));
                            if (res.CacheClusters && res.CacheClusters.length > 0 && res.CacheClusters[0].CacheClusterStatus === 'available') {
                                item.status = 'Active';
                                updatedStorage = true;
                            }
                        }
                    }
                    catch (e) {
                        console.error(`Failed to check AWS status for ${item.id}:`, e.message);
                    }
                }
            }
            if (updatedStorage) {
                await firebase_1.db.collection('projects').doc(projectId).update({ storage: project.storage });
            }
        }
        let latestCommitMessage = 'Deployed via BravoCloud';
        try {
            if (project.repoUrl && req.user.githubToken) {
                const urlParts = project.repoUrl.replace('https://github.com/', '').split('/');
                const owner = urlParts[0];
                const repo = urlParts[1];
                const { Octokit } = require('@octokit/rest');
                const octokit = new Octokit({ auth: req.user.githubToken });
                const { data: branchData } = await octokit.rest.repos.getBranch({
                    owner,
                    repo,
                    branch: project.branch || 'main'
                });
                if (branchData && branchData.commit && branchData.commit.commit) {
                    latestCommitMessage = branchData.commit.commit.message.split('\n')[0];
                }
            }
        }
        catch (e) {
            console.error('Failed to get latest commit message:', e);
        }
        res.json({ project: { id: projectDoc.id, ...project, taskIp, latestCommitMessage } });
    }
    catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});
// Get a project's deployments
router.get('/:id/deployments', middleware_1.verifyToken, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.id;
        // Verify ownership
        const projectDoc = await firebase_1.db.collection('projects').doc(projectId).get();
        if (!projectDoc.exists) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const project = projectDoc.data();
        if (project.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const depsSnapshot = await firebase_1.db.collection('deployments')
            .where('projectId', '==', projectId)
            .get();
        let deployments = depsSnapshot.docs.map(d => ({ ...d.data(), projectName: project.name }));
        deployments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.json({ deployments });
    }
    catch (error) {
        console.error('Error fetching deployments:', error);
        res.status(500).json({ error: 'Failed to fetch deployments' });
    }
});
// Redeploy an existing project
router.post('/:id/redeploy', middleware_1.verifyToken, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.id;
        // Fetch project
        const projectDoc = await firebase_1.db.collection('projects').doc(projectId).get();
        if (!projectDoc.exists) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const projectData = projectDoc.data();
        if (projectData.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        // Fetch user for GitHub Token
        const userDoc = await firebase_1.db.collection('users').doc(userId).get();
        const user = userDoc.data();
        // Create new deployment
        const deploymentRef = firebase_1.db.collection('deployments').doc();
        const deploymentData = {
            id: deploymentRef.id,
            projectId: projectData.id,
            status: 'QUEUED',
            commitHash: 'redeploy-trigger',
            createdAt: new Date().toISOString()
        };
        await deploymentRef.set(deploymentData);
        // Parse repo owner/name
        const urlParts = new URL(projectData.repoUrl).pathname.split('/').filter(Boolean);
        const repoOwner = urlParts[0];
        const repoName = urlParts[1];
        // Get ECR URI gracefully (returns existing without error)
        let ecrUri = '';
        try {
            ecrUri = await (0, aws_1.createEcrRepository)(projectData.name, userId);
        }
        catch (awsError) {
            console.error('Failed to get AWS ECR Repository:', awsError);
            return res.status(500).json({ error: 'Failed to access AWS infrastructure' });
        }
        // Generate files
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers.host;
        const dynamicBackendUrl = `${protocol}://${host}`;
        const webhookUrl = `${process.env.BACKEND_URL || dynamicBackendUrl}/api/deployments/webhook`;
        try {
            if (projectData.agentId) {
                // Route to self-hosted agent
                const newJob = {
                    agentId: projectData.agentId,
                    projectId: projectData.id,
                    deploymentId: deploymentRef.id,
                    repository: projectData.repoUrl,
                    projectName: projectData.name,
                    rootDir: projectData.rootDir,
                    installCommand: projectData.installCommand,
                    buildCommand: projectData.buildCommand,
                    status: 'Pending',
                    createdAt: new Date().toISOString()
                };
                await firebase_1.db.collection('users').doc(userId).collection('agent_jobs').add(newJob);
                await deploymentRef.update({ status: 'BUILDING' });
            }
            else {
                // Route to AWS CodeBuild
                const { startCodeBuildJob } = require('../lib/aws');
                await startCodeBuildJob(projectData.name, user.githubToken, projectData.repoUrl, projectData.branch || 'main', projectData.framework, projectData.buildCommand, projectData.installCommand, projectData.outputDirectory, projectData.rootDir, webhookUrl, deploymentRef.id, userId);
                await deploymentRef.update({ status: 'BUILDING' });
            }
        }
        catch (awsError) {
            console.error('Failed to trigger deployment:', awsError);
            await deploymentRef.update({ status: 'FAILED' });
            return res.status(500).json({ error: 'Failed to trigger deployment' });
        }
        res.json({ message: 'Redeployment triggered successfully', deployment: deploymentData });
    }
    catch (error) {
        console.error('Error redeploying project:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Rollback to a specific deployment
router.post('/:id/deployments/:deploymentId/rollback', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id: projectId, deploymentId } = req.params;
        const projectRef = firebase_1.db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const projectData = projectDoc.data();
        if (projectData.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const targetDeploymentRef = firebase_1.db.collection('deployments').doc(deploymentId);
        const targetDeploymentDoc = await targetDeploymentRef.get();
        if (!targetDeploymentDoc.exists) {
            return res.status(404).json({ error: 'Deployment not found' });
        }
        const targetDeploymentData = targetDeploymentDoc.data();
        if (targetDeploymentData.projectId !== projectId) {
            return res.status(400).json({ error: 'Deployment does not belong to this project' });
        }
        if (!targetDeploymentData.commitHash || targetDeploymentData.commitHash === 'redeploy-trigger' || targetDeploymentData.commitHash === 'manual') {
            return res.status(400).json({ error: 'This deployment cannot be rolled back because it lacks a specific image hash.' });
        }
        // Create a new deployment record for the rollback
        const newDeploymentRef = firebase_1.db.collection('deployments').doc();
        const newDeploymentData = {
            id: newDeploymentRef.id,
            projectId: projectData.id,
            status: 'QUEUED',
            commitHash: targetDeploymentData.commitHash, // Reuse the hash
            commitMessage: `Rollback to ${targetDeploymentData.commitHash.substring(0, 7)}`,
            createdAt: new Date().toISOString()
        };
        await newDeploymentRef.set(newDeploymentData);
        res.json({ message: 'Rollback initiated successfully', deployment: newDeploymentData });
        // Perform rollback asynchronously
        (async () => {
            try {
                await newDeploymentRef.update({ status: 'BUILDING' });
                const { getAwsAccountId, deployToECS, getEcsTaskPublicIp } = require('../lib/aws');
                const ecrRepoName = `bravocloud-${projectData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
                const region = process.env.AWS_REGION || "us-east-1";
                const accountId = await getAwsAccountId();
                // Pass the exact commitHash instead of 'latest'
                const imageUri = `${accountId}.dkr.ecr.${region}.amazonaws.com/${ecrRepoName}:${targetDeploymentData.commitHash}`;
                const envs = projectData.envVars ? projectData.envVars : undefined;
                const ecsUrl = await deployToECS(projectData.name, imageUri, envs);
                // Wait briefly for the new task to stabilize, then get its IP
                await new Promise(r => setTimeout(r, 10000));
                const taskIp = await getEcsTaskPublicIp(projectData.name);
                // Update project
                const updatePayload = {};
                if (ecsUrl) {
                    updatePayload.subdomain = ecsUrl.replace('http://', '').replace('https://', '').split('/')[0];
                }
                if (taskIp) {
                    updatePayload.taskIp = taskIp;
                }
                if (Object.keys(updatePayload).length > 0) {
                    await projectRef.update(updatePayload);
                }
                // Update deployment status
                await newDeploymentRef.update({ status: 'SUCCESS' });
            }
            catch (err) {
                console.error('Rollback failed:', err);
                await newDeploymentRef.update({ status: 'FAILED' });
            }
        })();
    }
    catch (error) {
        console.error('Error rolling back project:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Fetch GitHub Build Logs
router.get('/:id/logs/build', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id: projectId } = req.params;
        const projectRef = firebase_1.db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists)
            return res.status(404).json({ error: 'Project not found' });
        const projectData = projectDoc.data();
        if (projectData.userId !== userId)
            return res.status(403).json({ error: 'Unauthorized' });
        const userDoc = await firebase_1.db.collection('users').doc(userId).get();
        const user = userDoc.data();
        if (!user?.githubToken)
            return res.status(400).json({ error: 'GitHub token not found' });
        if (!projectData.repoUrl)
            return res.status(400).json({ error: 'Repo URL not found on project' });
        const urlParts = projectData.repoUrl.replace('https://github.com/', '').replace('.git', '').split('/');
        const repoOwner = urlParts[0];
        const repoName = urlParts[1];
        // Get latest deployments
        const deploymentsSnapshot = await firebase_1.db.collection('deployments')
            .where('projectId', '==', projectId)
            .get();
        if (deploymentsSnapshot.empty)
            return res.json({ jobs: [] });
        // Sort in memory to avoid requiring a Firestore composite index
        const deployments = deploymentsSnapshot.docs.map(doc => doc.data());
        deployments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const latestDep = deployments[0];
        if (projectData.agentId) {
            // Local Agent Deploy
            const agentJobsSnapshot = await firebase_1.db.collection('users').doc(userId).collection('agent_jobs')
                .where('deploymentId', '==', latestDep.id).limit(1).get();
            if (agentJobsSnapshot.empty) {
                return res.json({ jobs: [], rawLog: 'No logs found for this agent deployment.' });
            }
            const jobId = agentJobsSnapshot.docs[0].id;
            const logsSnapshot = await firebase_1.db.collection('users').doc(userId).collection('agent_jobs').doc(jobId).collection('logs').orderBy('timestamp', 'asc').get();
            const rawLog = logsSnapshot.docs.map(d => {
                const l = d.data();
                return `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.log}`;
            }).join('\n');
            return res.json({
                jobs: [{ id: jobId, name: 'Local Agent Build Process', status: 'completed' }],
                rawLog: rawLog || 'Agent is starting up or no logs emitted yet...'
            });
        }
        // We fetch all workflow runs for the repo
        const runsRes = await fetchApi(`https://api.github.com/repos/${repoOwner}/${repoName}/actions/runs?per_page=10`, {
            headers: {
                'Authorization': `token ${user.githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (!runsRes.ok)
            return res.status(runsRes.status).json({ error: 'Failed to fetch runs' });
        const runsData = await runsRes.json();
        let targetRun = runsData.workflow_runs?.[0];
        // Try to find run by commit hash
        if (latestDep.commitHash && latestDep.commitHash !== 'redeploy-trigger' && latestDep.commitHash !== 'manual') {
            const match = runsData.workflow_runs?.find((r) => r.head_sha === latestDep.commitHash);
            if (match)
                targetRun = match;
        }
        if (!targetRun)
            return res.json({ jobs: [] });
        // Fetch jobs for that run
        const jobsRes = await fetchApi(targetRun.jobs_url, {
            headers: {
                'Authorization': `token ${user.githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (!jobsRes.ok)
            return res.status(jobsRes.status).json({ error: 'Failed to fetch jobs' });
        const jobsData = await jobsRes.json();
        const jobs = jobsData.jobs || [];
        let rawLog = "";
        if (jobs.length > 0) {
            const jobId = jobs[0].id;
            try {
                const logRes = await fetchApi(`https://api.github.com/repos/${repoOwner}/${repoName}/actions/jobs/${jobId}/logs`, {
                    headers: {
                        'Authorization': `token ${user.githubToken}`
                    }
                });
                if (logRes.ok) {
                    rawLog = await logRes.text();
                }
            }
            catch (e) {
                console.error("Error fetching raw job logs", e);
            }
        }
        res.json({ jobs, rawLog });
    }
    catch (error) {
        console.error('Error fetching build logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Fetch AWS Runtime Logs
router.get('/:id/logs/runtime', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id: projectId } = req.params;
        const projectRef = firebase_1.db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists)
            return res.status(404).json({ error: 'Project not found' });
        const projectData = projectDoc.data();
        if (projectData.userId !== userId)
            return res.status(403).json({ error: 'Unauthorized' });
        if (projectData.agentId) {
            return res.json({ logs: [{ timestamp: Date.now(), message: 'System Notice: Runtime logs for Self-Hosted Agents are securely streamed directly to your local machine\'s terminal, bypassing BravoCloud servers.' }] });
        }
        const sanitizedName = projectData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const logGroupName = `/ecs/bravocloud/${sanitizedName}`;
        const region = process.env.AWS_REGION || "us-east-1";
        const { CloudWatchLogsClient, FilterLogEventsCommand } = require("@aws-sdk/client-cloudwatch-logs");
        const cwClient = new CloudWatchLogsClient({ region });
        // Get logs from last 1 hour
        const startTime = Date.now() - (60 * 60 * 1000);
        try {
            const logRes = await cwClient.send(new FilterLogEventsCommand({
                logGroupName,
                startTime,
                limit: 100
            }));
            const events = logRes.events?.map((e) => ({
                timestamp: e.timestamp,
                message: e.message
            })) || [];
            res.json({ logs: events });
        }
        catch (cwErr) {
            if (cwErr.name === 'ResourceNotFoundException') {
                return res.json({ logs: [{ timestamp: Date.now(), message: 'Waiting for container to start and emit logs...' }] });
            }
            throw cwErr;
        }
    }
    catch (error) {
        console.error('Error fetching runtime logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update environment variables
router.patch('/:id/env', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id: projectId } = req.params;
        const { envVars } = req.body;
        const projectRef = firebase_1.db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists)
            return res.status(404).json({ error: 'Project not found' });
        const projectData = projectDoc.data();
        if (projectData.userId !== userId)
            return res.status(403).json({ error: 'Unauthorized' });
        if (typeof envVars !== 'object' || Array.isArray(envVars)) {
            return res.status(400).json({ error: 'envVars must be an object' });
        }
        await projectRef.update({ envVars });
        res.json({ success: true, envVars });
    }
    catch (error) {
        console.error('Error updating env vars:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Add custom domain
router.post('/:id/domains', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id: projectId } = req.params;
        const { domain } = req.body;
        const projectRef = firebase_1.db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists)
            return res.status(404).json({ error: 'Project not found' });
        const projectData = projectDoc.data();
        if (projectData.userId !== userId)
            return res.status(403).json({ error: 'Unauthorized' });
        if (!domain)
            return res.status(400).json({ error: 'Domain is required' });
        const currentDomains = projectData.domains || [];
        if (currentDomains.find((d) => d.domain === domain)) {
            return res.status(400).json({ error: 'Domain already added to this project' });
        }
        const { addCustomDomainRoute } = require('../lib/aws');
        const { certArn, cnameName, cnameValue, albDns } = await addCustomDomainRoute(projectData.name, domain, (projectData.port || 3000).toString());
        const newDomain = {
            domain,
            certArn,
            cnameName,
            cnameValue,
            albDns,
            status: 'Pending Verification'
        };
        const updatedDomains = [...currentDomains, newDomain];
        await projectRef.update({ domains: updatedDomains });
        res.json({ success: true, domains: updatedDomains });
    }
    catch (error) {
        console.error('Error adding domain:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
// Remove a custom domain
router.delete('/:id/domains/:domain', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id: projectId, domain } = req.params;
        const projectRef = firebase_1.db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists)
            return res.status(404).json({ error: 'Project not found' });
        const projectData = projectDoc.data();
        if (projectData.userId !== userId)
            return res.status(403).json({ error: 'Unauthorized' });
        const currentDomains = projectData.domains || [];
        const domainRecord = currentDomains.find((d) => d.domain === domain);
        if (domainRecord) {
            if (domainRecord.certArn) {
                const { removeCustomDomainRoute } = require('../lib/aws');
                await removeCustomDomainRoute(domainRecord.certArn);
            }
            const updatedDomains = currentDomains.filter((d) => d.domain !== domain);
            await projectRef.update({ domains: updatedDomains });
            res.json({ success: true, domains: updatedDomains });
        }
        else {
            res.status(404).json({ error: 'Domain not found on this project' });
        }
    }
    catch (error) {
        console.error('Error removing domain:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
// Add storage
router.post('/:id/storage', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id: projectId } = req.params;
        const { type } = req.body;
        const projectRef = firebase_1.db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists)
            return res.status(404).json({ error: 'Project not found' });
        const projectData = projectDoc.data();
        if (projectData.userId !== userId)
            return res.status(403).json({ error: 'Unauthorized' });
        const currentStorage = projectData.storage || [];
        let newStorageResource = null;
        const currentEnvVars = projectData.envVars || {};
        let newEnvVars = { ...currentEnvVars };
        const { provisionS3Bucket, provisionPostgresDatabase, provisionRedisCache } = require('../lib/aws');
        if (type === 's3') {
            const { bucketName, region } = await provisionS3Bucket(projectData.name, userId);
            newStorageResource = { id: bucketName, type: 's3', name: bucketName, status: 'Active', region };
            newEnvVars['AWS_S3_BUCKET_NAME'] = bucketName;
            newEnvVars['AWS_REGION'] = region;
        }
        else if (type === 'postgres') {
            const { dbIdentifier, username, password, mockEndpoint } = await provisionPostgresDatabase(projectData.name, userId);
            newStorageResource = { id: dbIdentifier, type: 'postgres', name: dbIdentifier, status: 'Provisioning', endpoint: mockEndpoint };
            newEnvVars['POSTGRES_URL'] = `postgresql://${username}:${password}@${mockEndpoint}:5432/postgres`;
            newEnvVars['POSTGRES_USER'] = username;
            newEnvVars['POSTGRES_PASSWORD'] = password;
        }
        else if (type === 'redis') {
            const { clusterId, mockEndpoint } = await provisionRedisCache(projectData.name, userId);
            newStorageResource = { id: clusterId, type: 'redis', name: clusterId, status: 'Provisioning', endpoint: mockEndpoint };
            newEnvVars['REDIS_URL'] = `redis://${mockEndpoint}:6379`;
        }
        else {
            return res.status(400).json({ error: 'Invalid storage type' });
        }
        const updatedStorage = [...currentStorage, newStorageResource];
        await projectRef.update({
            storage: updatedStorage,
            envVars: newEnvVars
        });
        res.json({ success: true, storage: updatedStorage, envVars: newEnvVars });
    }
    catch (error) {
        console.error('Error adding storage:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
// Remove storage
router.delete('/:id/storage/:storageId', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id: projectId, storageId } = req.params;
        const projectRef = firebase_1.db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists)
            return res.status(404).json({ error: 'Project not found' });
        const projectData = projectDoc.data();
        if (projectData.userId !== userId)
            return res.status(403).json({ error: 'Unauthorized' });
        const currentStorage = projectData.storage || [];
        const itemToDelete = currentStorage.find((s) => s.id === storageId);
        if (itemToDelete) {
            const { deleteStorageResource } = require('../lib/aws');
            await deleteStorageResource(itemToDelete);
        }
        const updatedStorage = currentStorage.filter((s) => s.id !== storageId);
        await projectRef.update({ storage: updatedStorage });
        res.json({ success: true, storage: updatedStorage });
    }
    catch (error) {
        console.error('Error removing storage:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
// Update workflow YAML
router.patch('/:id/workflow', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id: projectId } = req.params;
        const { workflowYaml } = req.body;
        if (typeof workflowYaml !== 'string') {
            return res.status(400).json({ error: 'workflowYaml must be a string' });
        }
        const projectRef = firebase_1.db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists)
            return res.status(404).json({ error: 'Project not found' });
        const projectData = projectDoc.data();
        if (projectData.userId !== userId)
            return res.status(403).json({ error: 'Unauthorized' });
        await projectRef.update({ workflowYaml });
        res.json({ success: true, workflowYaml });
    }
    catch (error) {
        console.error('Error updating workflow:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
// Update project metadata
router.patch('/:id', middleware_1.verifyToken, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.id;
        const updates = req.body;
        const projectRef = firebase_1.db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists)
            return res.status(404).json({ error: 'Project not found' });
        const projectData = projectDoc.data();
        if (projectData.userId !== userId)
            return res.status(403).json({ error: 'Unauthorized' });
        // Filter allowed fields
        const allowedFields = [
            'name', 'framework', 'buildCommand', 'outputDirectory', 'installCommand', 'rootDir', 'repoUrl', 'branch',
            'passwordProtection', 'accessPassword', 'ipAccessMode', 'ipList', 'serverlessFunctions', 'cronJobs', 'edgeNetwork',
            'maintenanceMode', 'isPaused', 'ownerEmail', 'autoScaling', 'logDrain', 'agentId'
        ];
        const filteredUpdates = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key] === "" ? null : updates[key];
            }
        }
        if (Object.keys(filteredUpdates).length > 0) {
            await projectRef.update(filteredUpdates);
            // If Agent Routing was updated, handle the transfer
            if (filteredUpdates.agentId !== undefined && filteredUpdates.agentId !== projectData.agentId) {
                try {
                    const userDoc = await firebase_1.db.collection('users').doc(userId).get();
                    const user = userDoc.data();
                    const deploymentRef = firebase_1.db.collection('deployments').doc();
                    const deploymentData = {
                        id: deploymentRef.id,
                        projectId: projectData.id,
                        status: 'QUEUED',
                        commitHash: 'routing-transfer',
                        createdAt: new Date().toISOString()
                    };
                    await deploymentRef.set(deploymentData);
                    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                    const host = req.headers.host;
                    const dynamicBackendUrl = `${protocol}://${host}`;
                    const webhookUrl = `${process.env.BACKEND_URL || dynamicBackendUrl}/api/deployments/webhook`;
                    // Ensure ECR exists just in case (non-blocking)
                    const { createEcrRepository } = require('../lib/aws');
                    createEcrRepository(projectData.name, userId).catch(() => { });
                    if (filteredUpdates.agentId) {
                        // Transferring to Self-Hosted
                        // Pause AWS compute to save resources instantly
                        const { setProjectComputeState } = require('../lib/aws');
                        setProjectComputeState(projectData.name, true).catch((e) => console.error("Compute pause failed:", e));
                        const newJob = {
                            agentId: filteredUpdates.agentId,
                            projectId: projectData.id,
                            deploymentId: deploymentRef.id,
                            repository: projectData.repoUrl,
                            projectName: projectData.name,
                            rootDir: projectData.rootDir,
                            installCommand: projectData.installCommand,
                            buildCommand: projectData.buildCommand,
                            status: 'Pending',
                            createdAt: new Date().toISOString()
                        };
                        await firebase_1.db.collection('users').doc(userId).collection('agent_jobs').add(newJob);
                        await deploymentRef.update({ status: 'BUILDING' });
                    }
                    else {
                        // Transferring to AWS
                        const { startCodeBuildJob } = require('../lib/aws');
                        startCodeBuildJob(projectData.name, user.githubToken, projectData.repoUrl, projectData.branch || 'main', projectData.framework, projectData.buildCommand, projectData.installCommand, projectData.outputDirectory, projectData.rootDir, webhookUrl, deploymentRef.id, userId).catch(() => { });
                        await deploymentRef.update({ status: 'BUILDING' });
                    }
                }
                catch (err) {
                    console.error("Transfer trigger failed:", err);
                }
            }
            // If WAF settings were updated, trigger the AWS WAF sync
            if (filteredUpdates.ipAccessMode || filteredUpdates.ipList) {
                const { updateProjectWAF } = require('../lib/aws');
                const mode = filteredUpdates.ipAccessMode || projectData.ipAccessMode || 'allow_all';
                const ips = filteredUpdates.ipList || projectData.ipList || [];
                // Run asynchronously
                updateProjectWAF(projectData.name, mode, ips).catch((e) => console.error("WAF update failed:", e));
            }
            // If Password Protection settings were updated, trigger Cognito/ALB Auth sync
            if (filteredUpdates.passwordProtection !== undefined || filteredUpdates.accessPassword !== undefined) {
                const { syncProjectCognitoAuth, updateProjectALBAuth } = require('../lib/aws');
                const isEnabled = filteredUpdates.passwordProtection ?? projectData.passwordProtection ?? false;
                const password = filteredUpdates.accessPassword ?? projectData.accessPassword ?? '';
                // Run asynchronously
                (async () => {
                    try {
                        let clientId;
                        if (isEnabled && password) {
                            const res = await syncProjectCognitoAuth(projectData.name, password);
                            clientId = res.clientId;
                        }
                        await updateProjectALBAuth(projectData.name, isEnabled && !!password, clientId);
                    }
                    catch (e) {
                        console.error("Cognito/ALB Auth sync failed:", e.message);
                    }
                })();
            }
            // If Serverless Functions were updated, trigger sync
            if (filteredUpdates.serverlessFunctions !== undefined) {
                const { syncServerlessFunctions } = require('../lib/aws');
                syncServerlessFunctions(projectData.name, filteredUpdates.serverlessFunctions).catch((e) => console.error("Serverless sync failed:", e));
            }
            // If Cron Jobs were updated, trigger sync
            if (filteredUpdates.cronJobs !== undefined) {
                const { syncCronJobs } = require('../lib/aws');
                syncCronJobs(projectData.name, filteredUpdates.cronJobs).catch((e) => console.error("Cron Jobs sync failed:", e));
            }
            // If Edge Network was updated, trigger sync
            if (filteredUpdates.edgeNetwork !== undefined) {
                const { syncEdgeNetwork } = require('../lib/aws');
                syncEdgeNetwork(projectData.name, filteredUpdates.edgeNetwork).catch((e) => console.error("Edge Network sync failed:", e));
            }
            // If Maintenance Mode was updated, trigger sync
            if (filteredUpdates.maintenanceMode !== undefined) {
                const { setMaintenanceMode } = require('../lib/aws');
                setMaintenanceMode(projectData.name, filteredUpdates.maintenanceMode).catch((e) => console.error("Maintenance sync failed:", e));
            }
            // If Pause State was updated, trigger sync
            if (filteredUpdates.isPaused !== undefined) {
                const { setProjectComputeState } = require('../lib/aws');
                setProjectComputeState(projectData.name, filteredUpdates.isPaused).catch((e) => console.error("Compute state sync failed:", e));
            }
            // If Auto-Scaling was updated, trigger sync
            if (filteredUpdates.autoScaling !== undefined) {
                const { syncAutoScaling } = require('../lib/aws');
                syncAutoScaling(projectData.name, filteredUpdates.autoScaling).catch((e) => console.error("AutoScaling sync failed:", e));
            }
            // If Log Drain was updated, trigger sync
            if (filteredUpdates.logDrain !== undefined) {
                const { syncLogDrain } = require('../lib/aws');
                syncLogDrain(projectData.name, filteredUpdates.logDrain).catch((e) => console.error("Log drain sync failed:", e));
            }
        }
        const updatedDoc = await projectRef.get();
        res.json({ message: 'Project updated', project: { id: updatedDoc.id, ...updatedDoc.data() } });
    }
    catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: error.message });
    }
});
// Trigger a manual database snapshot
router.post('/:id/snapshot', middleware_1.verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const projectRef = firebase_1.db.collection('projects').doc(id);
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const projectData = projectDoc.data();
        if (projectData.userId !== req.user.uid) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const { createDatabaseSnapshot } = require('../lib/aws');
        await createDatabaseSnapshot(projectData.name);
        res.json({ message: 'Snapshot successfully initiated' });
    }
    catch (error) {
        console.error('Error creating snapshot:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get repository branches
router.get('/:id/branches', middleware_1.verifyToken, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.id;
        const projectDoc = await firebase_1.db.collection('projects').doc(projectId).get();
        if (!projectDoc.exists)
            return res.status(404).json({ error: 'Project not found' });
        const projectData = projectDoc.data();
        if (projectData.userId !== userId)
            return res.status(403).json({ error: 'Unauthorized' });
        if (!projectData.repoUrl)
            return res.json({ branches: [] });
        const userDoc = await firebase_1.db.collection('users').doc(userId).get();
        const user = userDoc.data();
        if (!user?.githubToken)
            return res.status(400).json({ error: 'GitHub token not found' });
        const urlParts = projectData.repoUrl.replace('https://github.com/', '').replace('.git', '').split('/');
        const owner = urlParts[0];
        const repo = urlParts[1];
        const { Octokit } = require('@octokit/rest');
        const octokit = new Octokit({ auth: user.githubToken });
        const branchesRes = await octokit.rest.repos.listBranches({ owner, repo, per_page: 100 });
        const branches = branchesRes.data.map((b) => b.name);
        res.json({ branches });
    }
    catch (error) {
        console.error('Error fetching branches:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
// Get repository directories
router.get('/:id/directories', middleware_1.verifyToken, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.id;
        const pathQuery = req.query.path || '';
        const projectDoc = await firebase_1.db.collection('projects').doc(projectId).get();
        if (!projectDoc.exists)
            return res.status(404).json({ error: 'Project not found' });
        const projectData = projectDoc.data();
        if (projectData.userId !== userId)
            return res.status(403).json({ error: 'Unauthorized' });
        if (!projectData.repoUrl)
            return res.json({ directories: [] });
        const userDoc = await firebase_1.db.collection('users').doc(userId).get();
        const user = userDoc.data();
        if (!user?.githubToken)
            return res.status(400).json({ error: 'GitHub token not found' });
        const urlParts = projectData.repoUrl.replace('https://github.com/', '').replace('.git', '').split('/');
        const owner = urlParts[0];
        const repo = urlParts[1];
        const { Octokit } = require('@octokit/rest');
        const octokit = new Octokit({ auth: user.githubToken });
        // Remove leading './' or '/' for GitHub API
        const cleanPath = pathQuery.replace(/^\.?\//, '');
        const contentRes = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: cleanPath,
            ref: projectData.branch || 'main'
        });
        let directories = [];
        if (Array.isArray(contentRes.data)) {
            directories = contentRes.data.filter((item) => item.type === 'dir').map((item) => item.name);
        }
        res.json({ directories });
    }
    catch (error) {
        // If path is not found (e.g., deleted), return empty
        if (error.status === 404) {
            return res.json({ directories: [] });
        }
        console.error('Error fetching directories:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
// Auto-detect serverless functions
router.get('/:id/detect-functions', middleware_1.verifyToken, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.id;
        const projectDoc = await firebase_1.db.collection('projects').doc(projectId).get();
        if (!projectDoc.exists)
            return res.status(404).json({ error: 'Project not found' });
        const projectData = projectDoc.data();
        if (projectData.userId !== userId)
            return res.status(403).json({ error: 'Unauthorized' });
        if (!projectData.repoUrl)
            return res.json({ functions: [] });
        const userDoc = await firebase_1.db.collection('users').doc(userId).get();
        const user = userDoc.data();
        if (!user?.githubToken)
            return res.status(400).json({ error: 'GitHub token not found' });
        const urlParts = projectData.repoUrl.replace('https://github.com/', '').replace('.git', '').split('/');
        const owner = urlParts[0];
        const repo = urlParts[1];
        const { Octokit } = require('@octokit/rest');
        const octokit = new Octokit({ auth: user.githubToken });
        // Look for functions in `api` or `src/api` directory
        let rootDir = projectData.rootDir || './';
        let apiPath = rootDir === './' ? 'api' : `${rootDir.replace(/^\.\//, '')}/api`;
        let contentRes;
        try {
            contentRes = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: apiPath,
                ref: projectData.branch || 'main'
            });
        }
        catch (e) {
            if (e.status === 404) {
                return res.json({ functions: [] });
            }
            throw e;
        }
        const functions = [];
        if (Array.isArray(contentRes.data)) {
            for (const item of contentRes.data) {
                if (item.type === 'file' && (item.name.endsWith('.js') || item.name.endsWith('.ts'))) {
                    const name = item.name.replace(/\.(js|ts)$/, '');
                    functions.push({
                        id: `func_${Math.random().toString(36).substr(2, 9)}`,
                        name: name,
                        handler: `${apiPath}/${item.name}`,
                        runtime: 'nodejs20.x',
                        memory: 128,
                        timeout: 10
                    });
                }
            }
        }
        res.json({ functions });
    }
    catch (error) {
        console.error('Error detecting functions:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
// Delete project
router.delete('/:id', middleware_1.verifyToken, async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.id;
        const projectRef = firebase_1.db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists)
            return res.status(404).json({ error: 'Project not found' });
        const projectData = projectDoc.data();
        if (projectData.userId !== userId)
            return res.status(403).json({ error: 'Unauthorized' });
        // 1. Delete AWS Infrastructure
        const { deleteProjectInfrastructure } = require('../lib/aws');
        try {
            await deleteProjectInfrastructure(projectData.name, projectData.storage || []);
        }
        catch (awsError) {
            console.error('Error during AWS teardown:', awsError);
            // We log but continue deletion to ensure BravoCloud state is cleaned up
        }
        // 2. Delete Project Document
        await projectRef.delete();
        // 3. Delete Deployments
        const deploymentsSnapshot = await firebase_1.db.collection('deployments').where('projectId', '==', projectId).get();
        const batch = firebase_1.db.batch();
        deploymentsSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
exports.default = router;
