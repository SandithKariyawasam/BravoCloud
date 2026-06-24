import { Router } from 'express';
import { db } from '../lib/firebase';
import { verifyToken } from '../lib/middleware';
import crypto from 'crypto';

const router = Router();

// GET /api/agents
// List all self-hosted agents for the current user
router.get('/', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const agentsSnapshot = await db.collection('users').doc(userId).collection('agents').orderBy('createdAt', 'desc').get();
    const agents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ agents });
  } catch (error: any) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agents
// Register a new self-hosted agent
router.post('/', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { name, os, architecture } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Agent name is required' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    
    const newAgent = {
      name,
      os: os || 'Unknown',
      architecture: architecture || 'Unknown',
      status: 'Offline', // Default status until it connects
      token, // In a real app, you might only show this once or hash it
      createdAt: new Date().toISOString(),
      lastSeen: null,
      ipAddress: null,
    };

    const docRef = await db.collection('users').doc(userId).collection('agents').add(newAgent);
    res.json({ message: 'Agent generated successfully', agent: { id: docRef.id, ...newAgent } });
  } catch (error: any) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/agents/:id
// Remove an agent
router.delete('/:id', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    await db.collection('users').doc(userId).collection('agents').doc(id).delete();
    
    res.json({ message: 'Agent deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- AGENT DAEMON ENDPOINTS ---
// These do not use verifyToken because the agent passes its generated token in the body.

const findAgentByToken = async (token: string) => {
  const usersSnapshot = await db.collection('users').get();
  for (const userDoc of usersSnapshot.docs) {
    const agentsSnapshot = await db.collection('users').doc(userDoc.id).collection('agents').where('token', '==', token).get();
    if (!agentsSnapshot.empty) {
      return { userId: userDoc.id, agentId: agentsSnapshot.docs[0].id, agent: agentsSnapshot.docs[0].data() };
    }
  }
  return null;
};

// POST /api/agents/poll
router.post('/poll', async (req: any, res: any) => {
  try {
    const token = req.body.token?.trim();
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const agentData = await findAgentByToken(token);
    if (!agentData) {
      console.error(`Invalid token received: "${token}"`);
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Update agent status to online and lastSeen
    await db.collection('users').doc(agentData.userId).collection('agents').doc(agentData.agentId).update({
      status: 'Online',
      lastSeen: new Date().toISOString()
    });

    // Check for pending jobs
    const jobsSnapshot = await db.collection('users').doc(agentData.userId).collection('agent_jobs')
      .where('agentId', '==', agentData.agentId)
      .where('status', '==', 'Pending')
      .limit(1)
      .get();

    if (jobsSnapshot.empty) {
      return res.json({ job: null });
    }

    const jobDoc = jobsSnapshot.docs[0];
    await jobDoc.ref.update({ status: 'InProgress', startedAt: new Date().toISOString() });

    res.json({ job: { id: jobDoc.id, ...jobDoc.data() } });
  } catch (error: any) {
    console.error('Error polling agent:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agents/logs
router.post('/logs', async (req: any, res: any) => {
  try {
    const { token, jobId, log } = req.body;
    const agentData = await findAgentByToken(token);
    if (!agentData) return res.status(401).json({ error: 'Invalid token' });

    await db.collection('users').doc(agentData.userId).collection('agent_jobs').doc(jobId).collection('logs').add({
      log,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agents/complete
router.post('/complete', async (req: any, res: any) => {
  try {
    const { token, jobId, status, publicUrl } = req.body;
    const agentData = await findAgentByToken(token);
    if (!agentData) return res.status(401).json({ error: 'Invalid token' });

    const jobRef = db.collection('users').doc(agentData.userId).collection('agent_jobs').doc(jobId);
    const jobDoc = await jobRef.get();
    
    await jobRef.update({
      status, // 'Success' or 'Failed'
      completedAt: new Date().toISOString()
    });

    if (jobDoc.exists) {
      const jobData = jobDoc.data();
      if (jobData?.deploymentId) {
        const updateData: any = {
          status: status === 'Success' ? 'SUCCESS' : 'FAILED'
        };
        if (publicUrl) {
          updateData.publicUrl = publicUrl;
        }
        await db.collection('deployments').doc(jobData.deploymentId).update(updateData);
      }
    }

    // Set agent back to Online (idle) instead of InProgress
    await db.collection('users').doc(agentData.userId).collection('agents').doc(agentData.agentId).update({
      status: 'Online'
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN TEST ENDPOINTS ---

// POST /api/agents/admin/queue-job
router.post('/admin/queue-job', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { agentId, repository } = req.body;

    const newJob = {
      agentId,
      repository: repository || 'https://github.com/example/repo',
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('users').doc(userId).collection('agent_jobs').add(newJob);
    res.json({ message: 'Job queued successfully', jobId: docRef.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
// GET /api/agents/install.ps1
router.get('/install.ps1', (req: any, res: any) => {
  const token = req.query.token as string;
  if (!token) return res.status(400).send("Error: Missing token query parameter");

  const backendUrl = req.protocol + '://' + req.get('host');

  const script = `
Write-Host "BravoCloud Windows Agent Installer" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

$installDir = "$env:APPDATA\\BravoCloudAgent"
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
}

Write-Host "Stopping existing agent processes..." -ForegroundColor Yellow
# Find and kill any node.exe process whose command line contains bravocloud-agent.js
Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'bravocloud-agent\\.js' } | Invoke-CimMethod -MethodName Terminate | Out-Null

$scriptUrl = "${backendUrl}/api/agents/agent.js?token=${token}"
$scriptPath = "$installDir\\bravocloud-agent.js"

Write-Host "Downloading agent script..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $scriptUrl -OutFile $scriptPath

Write-Host "Agent installed to $installDir" -ForegroundColor Green
Write-Host "Starting Agent in background..." -ForegroundColor Yellow

Set-Location -Path $installDir
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "bravocloud-agent.js"
Write-Host "BravoCloud Agent started. Waiting for jobs..." -ForegroundColor Green
`;

  res.setHeader('Content-Type', 'text/plain');
  res.send(script);
});

// GET /api/agents/install-agent.sh
router.get('/install-agent.sh', (req: any, res: any) => {
  const token = req.query.token as string;
  if (!token) return res.status(400).send("Error: Missing token query parameter");

  const backendUrl = req.protocol + '://' + req.get('host');

  const script = `#!/bin/bash
echo -e "\\e[36mBravoCloud Linux/Mac Agent Installer\\e[0m"
echo -e "\\e[36m====================================\\e[0m"

echo -e "\\e[33mStopping existing agent processes...\\e[0m"
pkill -f "node bravocloud-agent.js" || true

INSTALL_DIR="$HOME/.bravocloud-agent"
mkdir -p "$INSTALL_DIR"

SCRIPT_URL="${backendUrl}/api/agents/agent.js?token=${token}"
SCRIPT_PATH="$INSTALL_DIR/bravocloud-agent.js"

echo -e "\\e[33mDownloading agent script...\\e[0m"
curl -sSL "$SCRIPT_URL" -o "$SCRIPT_PATH"

echo -e "\\e[32mAgent installed to $INSTALL_DIR\\e[0m"
echo -e "\\e[33mStarting Agent in background...\\e[0m"

cd "$INSTALL_DIR"
nohup node bravocloud-agent.js > agent.log 2>&1 &
echo -e "\\e[32mBravoCloud Agent started. Waiting for jobs...\\e[0m"
`;

  res.setHeader('Content-Type', 'text/plain');
  res.send(script);
});

// GET /api/agents/agent.js
router.get('/agent.js', (req: any, res: any) => {
  const token = req.query.token as string;
  if (!token) return res.status(400).send("Error: Missing token query parameter");

  const backendUrl = req.protocol + '://' + req.get('host');

  const script = `
const { exec, spawn } = require('child_process');

const token = "${token}";
const backendUrl = "${backendUrl}";

const runningServers = {};

console.log(\`[DEBUG] Agent initialized. Using token: "\${token}"\`);
console.log(\`[DEBUG] Target backend: \${backendUrl}\`);

async function sendLog(jobId, logLine) {
  try {
    await fetch(\`\${backendUrl}/api/agents/logs\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, jobId, logLine })
    });
  } catch (err) {
    console.error("Failed to send log:", err.message);
  }
}

async function executeJob(job) {
  console.log("Received job:", job.id);
  const repo = job.repository;
  const rootDir = job.rootDir && job.rootDir !== './' ? job.rootDir : '.';
  const installCmd = job.installCommand || 'npm install';
  const buildCmd = job.buildCommand || 'npm run build';
  
  if (runningServers[job.projectId]) {
    await sendLog(job.id, "Stopping previous deployment server...");
    try {
      runningServers[job.projectId].appProcess.kill();
      if (runningServers[job.projectId].tunnelProcess) {
        runningServers[job.projectId].tunnelProcess.kill();
      }
    } catch (e) {
      console.error("Failed to kill old process", e);
    }
  }

  const cloneCmd = \`git clone \${repo} repo_\${job.id} && cd repo_\${job.id} && cd "\${rootDir}" && \${installCmd} && \${buildCmd}\`;
  
  await sendLog(job.id, \`Starting job. Cloning repository and executing in \${rootDir}...\`);
  
  exec(cloneCmd, async (error, stdout, stderr) => {
    if (error) {
      console.error(\`exec error: \${error}\`);
      await sendLog(job.id, \`Error: \${error.message}\`);
      if (stdout) await sendLog(job.id, stdout);
      if (stderr) await sendLog(job.id, stderr);
      await sendLog(job.id, \`Job finished with status: Failed\`);
      
      await fetch(\`\${backendUrl}/api/agents/complete\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, jobId: job.id, status: "Failed" })
      });
      return;
    }

    if (stdout) await sendLog(job.id, stdout);
    await sendLog(job.id, \`Build successful! Starting application server on port 3000...\`);

    const appDir = \`repo_\${job.id}/\${rootDir}\`;
    
    const appProcess = spawn('npm', ['start'], { 
      cwd: appDir, 
      shell: true,
      env: { ...process.env, PORT: '3000' }
    });

    appProcess.stdout.on('data', (data) => console.log(\`[APP] \${data}\`));
    appProcess.stderr.on('data', (data) => console.error(\`[APP ERR] \${data}\`));

    await sendLog(job.id, "Exposing server to internet via localtunnel...");
    const tunnelProcess = spawn('npx', ['localtunnel', '--port', '3000'], { shell: true });
    
    runningServers[job.projectId] = { appProcess, tunnelProcess };

    let urlReported = false;

    tunnelProcess.stdout.on('data', async (data) => {
      const output = data.toString();
      console.log(\`[TUNNEL] \${output}\`);
      if (output.includes('your url is:') && !urlReported) {
        urlReported = true;
        const publicUrl = output.split('your url is:')[1].trim();
        await sendLog(job.id, \`Tunnel established: \${publicUrl}\`);
        await sendLog(job.id, \`Job finished with status: Success\`);
        
        await fetch(\`\${backendUrl}/api/agents/complete\`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, jobId: job.id, status: "Success", publicUrl })
        });
      }
    });

    tunnelProcess.stderr.on('data', (data) => {
      console.error(\`[TUNNEL ERR] \${data}\`);
    });
  });
}

async function poll() {
  try {
    const res = await fetch(\`\${backendUrl}/api/agents/poll\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.job) {
        await executeJob(data.job);
      }
    } else {
      const errText = await res.text();
      console.error(\`Poll failed: \${res.status} - \${errText}\`);
    }
  } catch (error) {
    console.error("Network error during polling:", error.message);
  }
  
  setTimeout(poll, 5000);
}

// Start polling
poll();
`;

  res.setHeader('Content-Type', 'application/javascript');
  res.send(script);
});

export default router;
