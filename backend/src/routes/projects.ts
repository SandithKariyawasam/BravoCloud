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
      ecrUri = await createEcrRepository(projectData.name, userId);
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
            } else if (item.type === 'redis') {
              const cacheClient = new ElastiCacheClient({ region });
              const res = await cacheClient.send(new DescribeCacheClustersCommand({ CacheClusterId: item.id }));
              if (res.CacheClusters && res.CacheClusters.length > 0 && res.CacheClusters[0].CacheClusterStatus === 'available') {
                item.status = 'Active';
                updatedStorage = true;
              }
            }
          } catch (e: any) {
            console.error(`Failed to check AWS status for ${item.id}:`, e.message);
          }
        }
      }

      if (updatedStorage) {
        await db.collection('projects').doc(projectId).update({ storage: project.storage });
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
      
    let deployments = depsSnapshot.docs.map(d => ({ ...d.data(), projectName: project.name }));
    deployments.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
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
      ecrUri = await createEcrRepository(projectData.name, userId);
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

// Rollback to a specific deployment
router.post('/:id/deployments/:deploymentId/rollback', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id: projectId, deploymentId } = req.params;

    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const projectData = projectDoc.data() as any;
    if (projectData.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const targetDeploymentRef = db.collection('deployments').doc(deploymentId);
    const targetDeploymentDoc = await targetDeploymentRef.get();
    
    if (!targetDeploymentDoc.exists) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    const targetDeploymentData = targetDeploymentDoc.data() as any;
    if (targetDeploymentData.projectId !== projectId) {
      return res.status(400).json({ error: 'Deployment does not belong to this project' });
    }
    
    if (!targetDeploymentData.commitHash || targetDeploymentData.commitHash === 'redeploy-trigger' || targetDeploymentData.commitHash === 'manual') {
      return res.status(400).json({ error: 'This deployment cannot be rolled back because it lacks a specific image hash.' });
    }

    // Create a new deployment record for the rollback
    const newDeploymentRef = db.collection('deployments').doc();
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
        const accountId = process.env.AWS_ACCOUNT_ID || await getAwsAccountId();
        
        // Pass the exact commitHash instead of 'latest'
        const imageUri = `${accountId}.dkr.ecr.${region}.amazonaws.com/${ecrRepoName}:${targetDeploymentData.commitHash}`;
        
        const envs = projectData.envVars ? (projectData.envVars as Record<string, string>) : undefined;
        const ecsUrl = await deployToECS(projectData.name, imageUri, envs);
        
        // Wait briefly for the new task to stabilize, then get its IP
        await new Promise(r => setTimeout(r, 10000));
        const taskIp = await getEcsTaskPublicIp(projectData.name);
        
        // Update project
        const updatePayload: any = {};
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
        
      } catch (err) {
        console.error('Rollback failed:', err);
        await newDeploymentRef.update({ status: 'FAILED' });
      }
    })();
    
  } catch (error) {
    console.error('Error rolling back project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch GitHub Build Logs
router.get('/:id/logs/build', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id: projectId } = req.params;

    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' });
    
    const projectData = projectDoc.data() as any;
    if (projectData.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });

    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data() as any;
    if (!user?.githubToken) return res.status(400).json({ error: 'GitHub token not found' });

    if (!projectData.repoUrl) return res.status(400).json({ error: 'Repo URL not found on project' });
    const urlParts = projectData.repoUrl.replace('https://github.com/', '').replace('.git', '').split('/');
    const repoOwner = urlParts[0];
    const repoName = urlParts[1];
    
    // Get latest deployments
    const deploymentsSnapshot = await db.collection('deployments')
      .where('projectId', '==', projectId)
      .get();
      
    if (deploymentsSnapshot.empty) return res.json({ jobs: [] });
    
    // Sort in memory to avoid requiring a Firestore composite index
    const deployments = deploymentsSnapshot.docs.map(doc => doc.data());
    deployments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latestDep = deployments[0];
    
    // We fetch all workflow runs for the repo
    const runsRes = await fetchApi(`https://api.github.com/repos/${repoOwner}/${repoName}/actions/runs?per_page=10`, {
      headers: {
        'Authorization': `token ${user.githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!runsRes.ok) return res.status(runsRes.status).json({ error: 'Failed to fetch runs' });
    
    const runsData = await runsRes.json();
    let targetRun = runsData.workflow_runs?.[0];
    
    // Try to find run by commit hash
    if (latestDep.commitHash && latestDep.commitHash !== 'redeploy-trigger' && latestDep.commitHash !== 'manual') {
      const match = runsData.workflow_runs?.find((r: any) => r.head_sha === latestDep.commitHash);
      if (match) targetRun = match;
    }
    
    if (!targetRun) return res.json({ jobs: [] });

    // Fetch jobs for that run
    const jobsRes = await fetchApi(targetRun.jobs_url, {
      headers: {
        'Authorization': `token ${user.githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!jobsRes.ok) return res.status(jobsRes.status).json({ error: 'Failed to fetch jobs' });
    
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
      } catch (e) {
        console.error("Error fetching raw job logs", e);
      }
    }

    res.json({ jobs, rawLog });

  } catch (error) {
    console.error('Error fetching build logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch AWS Runtime Logs
router.get('/:id/logs/runtime', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id: projectId } = req.params;

    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' });
    
    const projectData = projectDoc.data() as any;
    if (projectData.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });

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
      
      const events = logRes.events?.map((e: any) => ({
        timestamp: e.timestamp,
        message: e.message
      })) || [];
      
      res.json({ logs: events });
    } catch (cwErr: any) {
      if (cwErr.name === 'ResourceNotFoundException') {
        return res.json({ logs: [{ timestamp: Date.now(), message: 'Waiting for container to start and emit logs...' }] });
      }
      throw cwErr;
    }

  } catch (error) {
    console.error('Error fetching runtime logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update environment variables
router.patch('/:id/env', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id: projectId } = req.params;
    const { envVars } = req.body;

    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' });
    
    const projectData = projectDoc.data() as any;
    if (projectData.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });

    if (typeof envVars !== 'object' || Array.isArray(envVars)) {
      return res.status(400).json({ error: 'envVars must be an object' });
    }

    await projectRef.update({ envVars });
    
    res.json({ success: true, envVars });
  } catch (error) {
    console.error('Error updating env vars:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add custom domain
router.post('/:id/domains', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id: projectId } = req.params;
    const { domain } = req.body;

    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' });
    
    const projectData = projectDoc.data() as any;
    if (projectData.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });

    if (!domain) return res.status(400).json({ error: 'Domain is required' });

    const currentDomains = projectData.domains || [];
    if (currentDomains.find((d: any) => d.domain === domain)) {
      return res.status(400).json({ error: 'Domain already added to this project' });
    }

    const { addCustomDomainRoute } = require('../lib/aws');
    const { certArn, cnameName, cnameValue, albDns } = await addCustomDomainRoute(projectData.name, domain);

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
  } catch (error: any) {
    console.error('Error adding domain:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Remove a custom domain
router.delete('/:id/domains/:domain', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id: projectId, domain } = req.params;

    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' });
    
    const projectData = projectDoc.data() as any;
    if (projectData.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });

    const currentDomains = projectData.domains || [];
    const domainRecord = currentDomains.find((d: any) => d.domain === domain);

    if (domainRecord) {
      if (domainRecord.certArn) {
        const { removeCustomDomainRoute } = require('../lib/aws');
        await removeCustomDomainRoute(domainRecord.certArn);
      }
      
      const updatedDomains = currentDomains.filter((d: any) => d.domain !== domain);
      await projectRef.update({ domains: updatedDomains });
      res.json({ success: true, domains: updatedDomains });
    } else {
      res.status(404).json({ error: 'Domain not found on this project' });
    }
  } catch (error: any) {
    console.error('Error removing domain:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Add storage
router.post('/:id/storage', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id: projectId } = req.params;
    const { type } = req.body;

    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' });
    
    const projectData = projectDoc.data() as any;
    if (projectData.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });

    const currentStorage = projectData.storage || [];
    let newStorageResource: any = null;
    const currentEnvVars = projectData.envVars || {};
    let newEnvVars = { ...currentEnvVars };

    const { provisionS3Bucket, provisionPostgresDatabase, provisionRedisCache } = require('../lib/aws');

    if (type === 's3') {
      const { bucketName, region } = await provisionS3Bucket(projectData.name, userId);
      newStorageResource = { id: bucketName, type: 's3', name: bucketName, status: 'Active', region };
      newEnvVars['AWS_S3_BUCKET_NAME'] = bucketName;
      newEnvVars['AWS_REGION'] = region;
    } else if (type === 'postgres') {
      const { dbIdentifier, username, password, mockEndpoint } = await provisionPostgresDatabase(projectData.name, userId);
      newStorageResource = { id: dbIdentifier, type: 'postgres', name: dbIdentifier, status: 'Provisioning', endpoint: mockEndpoint };
      newEnvVars['POSTGRES_URL'] = `postgresql://${username}:${password}@${mockEndpoint}:5432/postgres`;
      newEnvVars['POSTGRES_USER'] = username;
      newEnvVars['POSTGRES_PASSWORD'] = password;
    } else if (type === 'redis') {
      const { clusterId, mockEndpoint } = await provisionRedisCache(projectData.name, userId);
      newStorageResource = { id: clusterId, type: 'redis', name: clusterId, status: 'Provisioning', endpoint: mockEndpoint };
      newEnvVars['REDIS_URL'] = `redis://${mockEndpoint}:6379`;
    } else {
      return res.status(400).json({ error: 'Invalid storage type' });
    }

    const updatedStorage = [...currentStorage, newStorageResource];
    
    await projectRef.update({ 
      storage: updatedStorage,
      envVars: newEnvVars
    });

    res.json({ success: true, storage: updatedStorage, envVars: newEnvVars });
  } catch (error: any) {
    console.error('Error adding storage:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Remove storage
router.delete('/:id/storage/:storageId', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id: projectId, storageId } = req.params;

    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' });
    
    const projectData = projectDoc.data() as any;
    if (projectData.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });

    const currentStorage = projectData.storage || [];
    const itemToDelete = currentStorage.find((s: any) => s.id === storageId);
    
    if (itemToDelete) {
      const { deleteStorageResource } = require('../lib/aws');
      await deleteStorageResource(itemToDelete);
    }

    const updatedStorage = currentStorage.filter((s: any) => s.id !== storageId);

    await projectRef.update({ storage: updatedStorage });
    
    res.json({ success: true, storage: updatedStorage });
  } catch (error: any) {
    console.error('Error removing storage:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update workflow YAML
router.patch('/:id/workflow', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id: projectId } = req.params;
    const { workflowYaml } = req.body;

    if (typeof workflowYaml !== 'string') {
      return res.status(400).json({ error: 'workflowYaml must be a string' });
    }

    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' });
    
    const projectData = projectDoc.data() as any;
    if (projectData.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });

    await projectRef.update({ workflowYaml });

    res.json({ success: true, workflowYaml });
  } catch (error: any) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
// Update project metadata
router.patch('/:id', verifyToken, async (req: any, res: any) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;
    const updates = req.body;

    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' });
    
    const projectData = projectDoc.data() as any;
    if (projectData.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });

    // Filter allowed fields
    const allowedFields = ['name', 'framework', 'buildCommand', 'outputDirectory', 'installCommand', 'rootDir'];
    const filteredUpdates: any = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key] === "" ? null : updates[key];
      }
    }

    if (Object.keys(filteredUpdates).length > 0) {
      await projectRef.update(filteredUpdates);
    }

    const updatedDoc = await projectRef.get();
    res.json({ success: true, project: updatedDoc.data() });
  } catch (error: any) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete project
router.delete('/:id', verifyToken, async (req: any, res: any) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;

    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' });
    
    const projectData = projectDoc.data() as any;
    if (projectData.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });

    // 1. Delete AWS Infrastructure
    const { deleteProjectInfrastructure } = require('../lib/aws');
    try {
      await deleteProjectInfrastructure(projectData.name, projectData.storage || []);
    } catch (awsError) {
      console.error('Error during AWS teardown:', awsError);
      // We log but continue deletion to ensure BravoCloud state is cleaned up
    }

    // 2. Delete Project Document
    await projectRef.delete();

    // 3. Delete Deployments
    const deploymentsSnapshot = await db.collection('deployments').where('projectId', '==', projectId).get();
    const batch = db.batch();
    deploymentsSnapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
