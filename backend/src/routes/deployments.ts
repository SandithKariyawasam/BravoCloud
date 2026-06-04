import { Router } from 'express';
import { db } from '../lib/firebase';
import { deployToECS, getAwsAccountId } from '../lib/aws';
import { verifyToken } from '../lib/middleware';

const router = Router();

// Get all deployments across all projects for the authenticated user
router.get('/', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    
    // 1. Get all projects owned by the user
    const projectsSnapshot = await db.collection('projects')
      .where('userId', '==', userId)
      .get();

    if (projectsSnapshot.empty) {
      return res.json({ deployments: [] });
    }

    const projects: Record<string, any> = {};
    projectsSnapshot.forEach(doc => {
      projects[doc.id] = { id: doc.id, ...doc.data() };
    });

    const projectIds = Object.keys(projects);

    // 2. Fetch deployments for these projects
    // Firestore 'in' query is limited to 10 items, so we fetch in chunks or individually
    const deployments: any[] = [];
    
    // For scalability without hitting the 10-item 'in' limit, we'll fetch them individually per project
    // Note: In a massive production system, we'd add userId to deployments directly to avoid this.
    const fetchPromises = projectIds.map(async (projectId) => {
      const depsSnap = await db.collection('deployments')
        .where('projectId', '==', projectId)
        .orderBy('createdAt', 'desc')
        .limit(20) // Limit per project to avoid huge payloads
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
  } catch (error) {
    console.error('Error fetching global deployments:', error);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

// Webhook for GitHub Actions to update deployment status
router.post('/webhook', async (req: any, res: any) => {
  try {
    const { projectId, deploymentId, status, commitHash } = req.body;

    if (!deploymentId || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const deploymentRef = db.collection('deployments').doc(deploymentId);
    const updateData: any = { status };
    if (commitHash) updateData.commitHash = commitHash;

    await deploymentRef.update(updateData);
    const updatedDoc = await deploymentRef.get();
    const updatedDeployment = updatedDoc.data();

    // If the build succeeded, push to App Runner
    if (status === 'SUCCESS' && projectId) {
      const projectRef = db.collection('projects').doc(projectId);
      const projectDoc = await projectRef.get();
      
      if (projectDoc.exists) {
        const project = projectDoc.data() as any;
        try {
          const ecrRepoName = `bravocloud-${project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
          // Generate the expected ECR URI format to pass to App Runner
          // In production, you would fetch this using DescribeRepositories or pass it in the webhook
          const region = process.env.AWS_REGION || "us-east-1";
          const accountId = process.env.AWS_ACCOUNT_ID || await getAwsAccountId();
          const imageUri = `${accountId}.dkr.ecr.${region}.amazonaws.com/${ecrRepoName}:latest`;

          const envs = project.envVars ? (project.envVars as Record<string, string>) : undefined;
          const ecsUrl = await deployToECS(project.name, imageUri, envs);
          
          console.log(`[Webhook] ECS Fargate Deployed! Live URL: ${ecsUrl}`);
          
          // Store the live URL on the project document
          if (ecsUrl) {
            await projectRef.update({
              subdomain: ecsUrl.replace('http://', '').replace('https://', '').split('/')[0]
            });
          }
        } catch (ecsErr) {
          console.error('[Webhook] Failed to deploy to ECS:', ecsErr);
        }
      }
    }

    console.log(`[Webhook] Deployment ${deploymentId} updated to ${status}`);
    res.json({ success: true, deployment: updatedDeployment });
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
