const admin = require('firebase-admin');

const serviceAccount = require('c:/Users/sandi/OneDrive/Documents/GitHub/BravoCloud/backend/firebase-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function testLogs() {
  const projectId = 'gF14ugnozrcBIycsxoox';
  const projectDoc = await db.collection('projects').doc(projectId).get();
  if (!projectDoc.exists) throw new Error("Project not found");
  
  const projectData = projectDoc.data();
  const userId = projectData.userId;

  const userDoc = await db.collection('users').doc(userId).get();
  const user = userDoc.data();
  
  if (!user?.githubToken) throw new Error("No github token");

  console.log("repoUrl:", projectData.repoUrl);
  const urlParts = projectData.repoUrl.replace('https://github.com/', '').replace('.git', '').split('/');
  const repoOwner = urlParts[0];
  const repoName = urlParts[1];

  console.log(`repoOwner=${repoOwner}, repoName=${repoName}`);

  const deploymentsSnapshot = await db.collection('deployments')
    .where('projectId', '==', projectId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
    
  if (deploymentsSnapshot.empty) {
    console.log("No deployments");
    return;
  }
  const latestDep = deploymentsSnapshot.docs[0].data();
  console.log("Latest dep:", latestDep);

  console.log("Fetching runs...");
  const runsRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/actions/runs?per_page=10`, {
    headers: {
      'Authorization': `token ${user.githubToken}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  if (!runsRes.ok) throw new Error(`Runs res not ok: ${runsRes.status}`);
  const runsData = await runsRes.json();
  let targetRun = runsData.workflow_runs?.[0];
  
  if (latestDep.commitHash && latestDep.commitHash !== 'redeploy-trigger' && latestDep.commitHash !== 'manual') {
    const match = runsData.workflow_runs?.find((r) => r.head_sha === latestDep.commitHash);
    if (match) targetRun = match;
  }
  
  if (!targetRun) {
    console.log("No target run found");
    return;
  }

  console.log("Fetching jobs... URL:", targetRun.jobs_url);
  const jobsRes = await fetch(targetRun.jobs_url, {
    headers: {
      'Authorization': `token ${user.githubToken}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  if (!jobsRes.ok) throw new Error(`Jobs res not ok: ${jobsRes.status}`);
  const jobsData = await jobsRes.json();
  const jobs = jobsData.jobs || [];

  if (jobs.length > 0) {
    const jobId = jobs[0].id;
    console.log("Fetching logs for job:", jobId);
    try {
      const logRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/actions/jobs/${jobId}/logs`, {
        headers: {
          'Authorization': `token ${user.githubToken}`
        }
      });
      console.log("Log res status:", logRes.status);
      if (logRes.ok) {
        console.log("Log fetched successfully");
      }
    } catch (e) {
      console.error("Error fetching raw job logs", e);
    }
  }

  console.log("DONE");
}

testLogs().catch(console.error);
