"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebase_1 = require("../lib/firebase");
const templates_1 = require("../lib/templates");
const github_1 = require("../lib/github");
const aws_1 = require("../lib/aws");
const middleware_1 = require("../lib/middleware");
// @ts-ignore
const node_fetch_1 = __importDefault(require("node-fetch"));
const router = (0, express_1.Router)();
const fetchApi = typeof node_fetch_1.default !== 'undefined' ? node_fetch_1.default : require('node-fetch');
// Create a new project
router.post('/', middleware_1.verifyToken, async (req, res) => {
    try {
        const { name, repoUrl, framework, branch = "main", rootDir = "./", buildCommand, outputDirectory, installCommand, envVars } = req.body;
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
        let ecrUri = '';
        try {
            ecrUri = await (0, aws_1.createEcrRepository)(projectData.name);
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
        const dockerfileContent = (0, templates_1.generateDockerfile)(framework, installCommand, buildCommand, outputDirectory);
        const workflowContent = (0, templates_1.generateWorkflow)(webhookUrl, projectRef.id, deploymentRef.id, ecrUri, branch, rootDir);
        // Make sure Dockerfile goes into the correct root directory
        let dockerfilePath = 'Dockerfile';
        if (rootDir !== './') {
            dockerfilePath = `${rootDir.substring(2)}/Dockerfile`;
        }
        const filesToCommit = [
            { path: dockerfilePath, content: dockerfileContent },
            {
                path: rootDir !== './' ? `${rootDir.substring(2)}/.dockerignore` : '.dockerignore',
                content: 'node_modules\n.next\n.git\n.env*\n'
            },
            { path: '.github/workflows/bravocloud.yml', content: workflowContent }
        ];
        let finalDeploymentData = { ...deploymentData };
        try {
            // Inject AWS credentials into the user's repository secrets
            if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
                try {
                    await (0, github_1.setupRepositorySecrets)(user.githubToken, repoOwner, repoName, {
                        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
                        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY
                    });
                    console.log(`[Secrets] Injected AWS credentials into ${repoOwner}/${repoName}`);
                }
                catch (secretErr) {
                    console.error(`[Secrets] Failed to inject AWS credentials:`, secretErr);
                    // We can proceed, but the GitHub action will fail.
                }
            }
            // Commit files to the user's repository
            const commit = await (0, github_1.commitProjectFiles)(user.githubToken, repoOwner, repoName, filesToCommit, branch);
            // Update deployment with actual commit hash and status
            finalDeploymentData.status = 'BUILDING';
            finalDeploymentData.commitHash = commit.sha;
            await deploymentRef.update({
                status: 'BUILDING',
                commitHash: commit.sha
            });
        }
        catch (githubError) {
            console.error('Failed to commit to GitHub:', githubError);
            finalDeploymentData.status = 'FAILED';
            await deploymentRef.update({ status: 'FAILED' });
            // We still return 201 because the project was created, but with a warning.
            return res.status(201).json({
                success: true,
                project: projectData,
                deployment: finalDeploymentData,
                warning: `Project created but failed to commit files to GitHub: ${githubError.message || githubError.toString()}`
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
        res.json({ project });
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
        let deployments = depsSnapshot.docs.map(d => d.data());
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
            ecrUri = await (0, aws_1.createEcrRepository)(projectData.name);
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
        const dockerfileContent = (0, templates_1.generateDockerfile)(projectData.framework, projectData.installCommand, projectData.buildCommand, projectData.outputDirectory);
        const workflowContent = (0, templates_1.generateWorkflow)(webhookUrl, projectData.id, deploymentRef.id, ecrUri, projectData.branch || 'main', projectData.rootDir || './');
        let dockerfilePath = 'Dockerfile';
        const rootDir = projectData.rootDir || './';
        if (rootDir !== './') {
            dockerfilePath = `${rootDir.substring(2)}/Dockerfile`;
        }
        const filesToCommit = [
            { path: dockerfilePath, content: dockerfileContent },
            {
                path: rootDir !== './' ? `${rootDir.substring(2)}/.dockerignore` : '.dockerignore',
                content: 'node_modules\n.next\n.git\n.env*\n'
            },
            { path: '.github/workflows/bravocloud.yml', content: workflowContent }
        ];
        // Push files to GitHub
        try {
            if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
                try {
                    await (0, github_1.setupRepositorySecrets)(user.githubToken, repoOwner, repoName, {
                        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
                        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY
                    });
                }
                catch (secretErr) { }
            }
            await (0, github_1.commitProjectFiles)(user.githubToken, repoOwner, repoName, filesToCommit, projectData.branch || 'main', `Redeploy BravoCloud project ${projectData.name}`);
        }
        catch (githubError) {
            console.error('Failed to commit redeploy files:', githubError);
            await deploymentRef.update({ status: 'FAILED' });
            return res.status(500).json({ error: 'Failed to trigger redeployment on GitHub' });
        }
        res.json({ message: 'Redeployment triggered successfully', deployment: deploymentData });
    }
    catch (error) {
        console.error('Error redeploying project:', error);
        res.status(500).json({ error: 'Internal server error' });
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
exports.default = router;
