import { Router } from 'express';
import { db } from '../lib/firebase';
import { generateDockerfile, generateWorkflow } from '../lib/templates';
import { commitProjectFiles, setupRepositorySecrets } from '../lib/github';
import { createEcrRepository } from '../lib/aws';

const router = Router();

import { verifyToken } from '../lib/middleware';

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
    const webhookUrl = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/deployments/webhook`;
    const dockerfileContent = generateDockerfile(framework, installCommand, buildCommand, outputDirectory);
    const workflowContent = generateWorkflow(webhookUrl, projectRef.id, deploymentRef.id, ecrUri, branch, rootDir);

    // Make sure Dockerfile goes into the correct root directory
    let dockerfilePath = 'Dockerfile';
    if (rootDir !== './') {
      dockerfilePath = `${rootDir.substring(2)}/Dockerfile`;
    }

    const filesToCommit = [
      { path: dockerfilePath, content: dockerfileContent },
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

export default router;
