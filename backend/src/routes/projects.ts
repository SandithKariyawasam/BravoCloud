import { Router } from 'express';
import { db } from '../lib/firebase';
import { generateDockerfile, generateWorkflow } from '../lib/templates';
import { commitProjectFiles, setupRepositorySecrets } from '../lib/github';
import { createEcrRepository } from '../lib/aws';
import { verifyToken } from '../lib/middleware';
// @ts-ignore
import fetch from 'node-fetch';

const router = Router();
const fetchApi = typeof fetch !== 'undefined' ? fetch : require('node-fetch');

// Create a new project
router.post('/', verifyToken, async (req: any, res: any) => {
  try {
    const { 
      name, 
      repoUrl, 
      framework, 
      branch = "main", 
      rootDir = "./",
      buildCommand,
      outputDirectory,
      installCommand,
      envVars
    } = req.body;
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
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(400).json({ error: 'User not found. Please log in again.' });
    }
    const user = userDoc.data() as any;
    if (!user || !user.githubToken) {
      return res.status(400).json({ error: 'GitHub token not found. Please log in again.' });
    }

    // Generate a simple subdomain based on project name
    const baseSubdomain = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    let subdomain = baseSubdomain;
    let counter = 1;
    
    // Ensure subdomain is unique
    while (true) {
      const existing = await db.collection('projects').where('subdomain', '==', subdomain).limit(1).get();
      if (existing.empty) break;
      subdomain = `${baseSubdomain}-${counter}`;
      counter++;
    }

    const projectRef = db.collection('projects').doc();
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
    const deploymentRef = db.collection('deployments').doc();
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
      ecrUri = await createEcrRepository(projectData.name);
    } catch (awsError) {
      console.error('Failed to create AWS ECR Repository:', awsError);
      return res.status(500).json({ error: 'Failed to provision AWS infrastructure' });
    }

    // Generate files
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers.host;
    const dynamicBackendUrl = `${protocol}://${host}`;
    const webhookUrl = `${process.env.BACKEND_URL || dynamicBackendUrl}/api/deployments/webhook`;
    
    const dockerfileContent = generateDockerfile(framework, installCommand, buildCommand, outputDirectory);
    const workflowContent = generateWorkflow(webhookUrl, projectRef.id, deploymentRef.id, ecrUri, branch, rootDir);

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
          await setupRepositorySecrets(
            user.githubToken,
            repoOwner,
            repoName,
            {
              AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
              AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY
            }
          );
          console.log(`[Secrets] Injected AWS credentials into ${repoOwner}/${repoName}`);
        } catch (secretErr) {
          console.error(`[Secrets] Failed to inject AWS credentials:`, secretErr);
          // We can proceed, but the GitHub action will fail.
        }
      }

      // Commit files to the user's repository
      const commit = await commitProjectFiles(
        user.githubToken,
        repoOwner,
        repoName,
        filesToCommit,
        branch
      );

      // Update deployment with actual commit hash and status
      finalDeploymentData.status = 'BUILDING';
      finalDeploymentData.commitHash = commit.sha;
      await deploymentRef.update({
        status: 'BUILDING',
        commitHash: commit.sha
      });
    } catch (githubError: any) {
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
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get user's projects
router.get('/', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    
    const projectsSnapshot = await db.collection('projects')
      .where('userId', '==', userId)
      .get();
      
    let projects = projectsSnapshot.docs.map(doc => doc.data());
    
    // In-memory sort to avoid requiring a composite index setup on Firebase
    projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    for (const project of projects) {
      // Fetch latest deployment
      const depsSnapshot = await db.collection('deployments')
        .where('projectId', '==', project.id)
        .get();
        
      let deployments = depsSnapshot.docs.map(d => d.data());
      deployments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      project.deployments = deployments.slice(0, 1);
    }
    
    res.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Proxy Favicon for dashboard cards (bypasses Mixed Content and parses HTML for correct icon)
router.get('/proxy-favicon', async (req: any, res: any) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).send('Missing url');

  try {
    const htmlRes = await fetchApi(targetUrl);
    if (!htmlRes.ok) return res.status(404).send('Site not responding');
    const html = await htmlRes.text();

    let faviconUrl = '';
    
    // Find <link rel="icon" ...> or <link rel="shortcut icon" ...>
    const linkRegex = /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["'][^>]*>/i;
    const linkRegex2 = /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["'][^>]*>/i;

    let match = html.match(linkRegex);
    if (match) {
      faviconUrl = match[1];
    } else {
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
    } else if (!faviconUrl.startsWith('http')) {
      finalFaviconUrl = `${targetUrl.replace(/\/$/, '')}/${faviconUrl}`;
    }

    const imageRes = await fetchApi(finalFaviconUrl);
    if (!imageRes.ok) return res.status(404).send('Favicon not found');

    const contentType = imageRes.headers.get('content-type') || 'image/x-icon';
    res.setHeader('Content-Type', contentType);
    
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error) {
    console.error('Failed to proxy favicon:', error);
    res.status(500).send('Failed to fetch favicon');
  }
});

// Get a single project
router.get('/:id', verifyToken, async (req: any, res: any) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;

    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectDoc.data() as any;
    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { getEcsTaskPublicIp } = require('../lib/aws');
    const taskIp = await getEcsTaskPublicIp(project.name);

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
    } catch (e) {
      console.error('Failed to get latest commit message:', e);
    }

    res.json({ project: { id: projectDoc.id, ...project, taskIp, latestCommitMessage } });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Get a project's deployments
router.get('/:id/deployments', verifyToken, async (req: any, res: any) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;

    // Verify ownership
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectDoc.data() as any;
    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const depsSnapshot = await db.collection('deployments')
      .where('projectId', '==', projectId)
      .get();
      
    let deployments = depsSnapshot.docs.map(d => d.data());
    deployments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({ deployments });
  } catch (error) {
    console.error('Error fetching deployments:', error);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

// Redeploy an existing project
router.post('/:id/redeploy', verifyToken, async (req: any, res: any) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;

    // Fetch project
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const projectData = projectDoc.data() as any;

    if (projectData.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Fetch user for GitHub Token
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data() as any;

    // Create new deployment
    const deploymentRef = db.collection('deployments').doc();
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
      ecrUri = await createEcrRepository(projectData.name);
    } catch (awsError) {
      console.error('Failed to get AWS ECR Repository:', awsError);
      return res.status(500).json({ error: 'Failed to access AWS infrastructure' });
    }

    // Generate files
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers.host;
    const dynamicBackendUrl = `${protocol}://${host}`;
    const webhookUrl = `${process.env.BACKEND_URL || dynamicBackendUrl}/api/deployments/webhook`;
    
    const dockerfileContent = generateDockerfile(projectData.framework, projectData.installCommand, projectData.buildCommand, projectData.outputDirectory);
    const workflowContent = generateWorkflow(webhookUrl, projectData.id, deploymentRef.id, ecrUri, projectData.branch || 'main', projectData.rootDir || './');

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
          await setupRepositorySecrets(user.githubToken, repoOwner, repoName, {
            AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
            AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY
          });
        } catch (secretErr) {}
      }
      
      await commitProjectFiles(
        user.githubToken,
        repoOwner,
        repoName,
        filesToCommit,
        projectData.branch || 'main',
        `Redeploy BravoCloud project ${projectData.name}`
      );
    } catch (githubError) {
      console.error('Failed to commit redeploy files:', githubError);
      await deploymentRef.update({ status: 'FAILED' });
      return res.status(500).json({ error: 'Failed to trigger redeployment on GitHub' });
    }

    res.json({ message: 'Redeployment triggered successfully', deployment: deploymentData });
  } catch (error) {
    console.error('Error redeploying project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
