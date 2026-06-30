"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebase_1 = require("../lib/firebase");
const middleware_1 = require("../lib/middleware");
const crypto_1 = __importDefault(require("crypto"));
const drains_1 = require("../lib/drains");
const alerts_1 = require("../lib/alerts");
const router = (0, express_1.Router)();
// GET /api/agents
// List all self-hosted agents for the current user
router.get('/', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const agentsSnapshot = await firebase_1.db.collection('users').doc(userId).collection('agents').orderBy('createdAt', 'desc').get();
        const agents = agentsSnapshot.docs.map(doc => {
            const data = doc.data();
            let status = data.status || 'Offline';
            // If the agent hasn't polled in the last 30 seconds, consider it disconnected
            if (data.lastSeen) {
                const lastSeenMs = new Date(data.lastSeen).getTime();
                const nowMs = new Date().getTime();
                if (nowMs - lastSeenMs > 30000) {
                    status = 'Offline';
                }
            }
            return { id: doc.id, ...data, status };
        });
        res.json({ agents });
    }
    catch (error) {
        console.error('Error fetching agents:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/agents
// Register a new self-hosted agent
router.post('/', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, os, architecture } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Agent name is required' });
        }
        const token = crypto_1.default.randomBytes(32).toString('hex');
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
        const docRef = await firebase_1.db.collection('users').doc(userId).collection('agents').add(newAgent);
        res.json({ message: 'Agent generated successfully', agent: { id: docRef.id, ...newAgent } });
    }
    catch (error) {
        console.error('Error creating agent:', error);
        res.status(500).json({ error: error.message });
    }
});
// DELETE /api/agents/:id
// Remove an agent
router.delete('/:id', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await firebase_1.db.collection('users').doc(userId).collection('agents').doc(id).delete();
        res.json({ message: 'Agent deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting agent:', error);
        res.status(500).json({ error: error.message });
    }
});
// --- AGENT DAEMON ENDPOINTS ---
// These do not use verifyToken because the agent passes its generated token in the body.
const findAgentByToken = async (token) => {
    const usersSnapshot = await firebase_1.db.collection('users').get();
    for (const userDoc of usersSnapshot.docs) {
        const agentsSnapshot = await firebase_1.db.collection('users').doc(userDoc.id).collection('agents').where('token', '==', token).get();
        if (!agentsSnapshot.empty) {
            return { userId: userDoc.id, agentId: agentsSnapshot.docs[0].id, agent: agentsSnapshot.docs[0].data() };
        }
    }
    return null;
};
// POST /api/agents/poll
router.post('/poll', async (req, res) => {
    try {
        const token = req.body.token?.trim();
        if (!token)
            return res.status(400).json({ error: 'Token is required' });
        const agentData = await findAgentByToken(token);
        if (!agentData) {
            console.error(`Invalid token received: "${token}"`);
            return res.status(401).json({ error: 'Invalid token' });
        }
        // Update agent status to online and lastSeen
        await firebase_1.db.collection('users').doc(agentData.userId).collection('agents').doc(agentData.agentId).update({
            status: 'Online',
            lastSeen: new Date().toISOString()
        });
        // Check for pending jobs
        const jobsSnapshot = await firebase_1.db.collection('users').doc(agentData.userId).collection('agent_jobs')
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
    }
    catch (error) {
        console.error('Error polling agent:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/agents/logs
router.post('/logs', async (req, res) => {
    try {
        const { token, jobId, log, logLine } = req.body;
        const finalLog = log || logLine || "";
        const agentData = await findAgentByToken(token);
        if (!agentData)
            return res.status(401).json({ error: 'Invalid token' });
        await firebase_1.db.collection('users').doc(agentData.userId).collection('agent_jobs').doc(jobId).collection('logs').add({
            log: finalLog,
            timestamp: new Date().toISOString()
        });
        // Asynchronously forward to log drains
        (0, drains_1.forwardLogToDrains)(agentData.userId, jobId, finalLog);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// POST /api/agents/complete
router.post('/complete', async (req, res) => {
    try {
        const { token, jobId, status, publicUrl } = req.body;
        const agentData = await findAgentByToken(token);
        if (!agentData)
            return res.status(401).json({ error: 'Invalid token' });
        const jobRef = firebase_1.db.collection('users').doc(agentData.userId).collection('agent_jobs').doc(jobId);
        const jobDoc = await jobRef.get();
        await jobRef.update({
            status, // 'Success' or 'Failed'
            completedAt: new Date().toISOString()
        });
        if (jobDoc.exists) {
            const jobData = jobDoc.data();
            if (jobData?.deploymentId) {
                const updateData = {
                    status: status === 'Success' ? 'SUCCESS' : 'FAILED'
                };
                if (publicUrl) {
                    updateData.publicUrl = publicUrl;
                }
                if (req.body.localUrl) {
                    updateData.localUrl = req.body.localUrl;
                }
                await firebase_1.db.collection('deployments').doc(jobData.deploymentId).update(updateData);
                // Trigger alerts
                const projectName = jobData.projectName || 'Local Project';
                if (status === 'Success') {
                    (0, alerts_1.triggerAlert)(agentData.userId, 'deployment_success', { projectName, deploymentId: jobData.deploymentId, url: publicUrl || req.body.localUrl || 'N/A' });
                }
                else {
                    (0, alerts_1.triggerAlert)(agentData.userId, 'deployment_failed', { projectName, deploymentId: jobData.deploymentId, error: 'Agent deployment failed' });
                }
            }
            // Execute deferred Agent Transfer teardown if successful
            if (status === 'Success' && jobData?.projectId) {
                const projectRef = firebase_1.db.collection('projects').doc(jobData.projectId);
                const projectDoc = await projectRef.get();
                if (projectDoc.exists) {
                    const project = projectDoc.data();
                    if (project?.pendingTransferFrom) {
                        if (project.pendingTransferFrom === 'aws') {
                            // AWS -> Local: Tear down AWS compute infrastructure
                            const { deleteComputeInfrastructure } = require('../lib/aws');
                            deleteComputeInfrastructure(project.name).catch((e) => console.error("Compute teardown failed:", e));
                            console.log(`[Local Agent] Deferred teardown of AWS compute for ${project.name}`);
                        }
                        else if (project.pendingTransferFrom !== agentData.agentId) {
                            // Local -> Local: Send KILL job to previous agent
                            const killJob = {
                                agentId: project.pendingTransferFrom,
                                projectId: jobData.projectId,
                                action: 'KILL',
                                status: 'Pending',
                                createdAt: new Date().toISOString()
                            };
                            await firebase_1.db.collection('users').doc(agentData.userId).collection('agent_jobs').add(killJob);
                            console.log(`[Local Agent] Deferred KILL job sent to local agent ${project.pendingTransferFrom}`);
                        }
                        const admin = require('firebase-admin');
                        await projectRef.update({
                            pendingTransferFrom: admin.firestore.FieldValue.delete()
                        });
                    }
                }
            }
        }
        // Set agent back to Online (idle) instead of InProgress
        await firebase_1.db.collection('users').doc(agentData.userId).collection('agents').doc(agentData.agentId).update({
            status: 'Online'
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// --- ADMIN TEST ENDPOINTS ---
// POST /api/agents/admin/queue-job
router.post('/admin/queue-job', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { agentId, repository } = req.body;
        const newJob = {
            agentId,
            repository: repository || 'https://github.com/example/repo',
            status: 'Pending',
            createdAt: new Date().toISOString()
        };
        const docRef = await firebase_1.db.collection('users').doc(userId).collection('agent_jobs').add(newJob);
        res.json({ message: 'Job queued successfully', jobId: docRef.id });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// GET /api/agents/install.ps1
router.get('/install.ps1', (req, res) => {
    const token = req.query.token;
    if (!token)
        return res.status(400).send("Error: Missing token query parameter");
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
router.get('/install-agent.sh', (req, res) => {
    const token = req.query.token;
    if (!token)
        return res.status(400).send("Error: Missing token query parameter");
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
router.get('/agent.js', (req, res) => {
    const token = req.query.token;
    if (!token)
        return res.status(400).send("Error: Missing token query parameter");
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
      body: JSON.stringify({ token, jobId, log: logLine })
    });
  } catch (err) {
    console.error("Failed to send log:", err.message);
  }
}

async function executeJob(job) {
  console.log("Received job:", job.id);
  
  if (job.action === 'KILL' || job.status === 'KILL') {
    if (runningServers[job.projectId]) {
      await sendLog(job.id, "Received KILL command. Stopping deployment server...");
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', runningServers[job.projectId].appProcess.pid, '/T', '/F']);
          if (runningServers[job.projectId].tunnelProcess) {
            spawn('taskkill', ['/pid', runningServers[job.projectId].tunnelProcess.pid, '/T', '/F']);
          }
        } else {
          runningServers[job.projectId].appProcess.kill();
          if (runningServers[job.projectId].tunnelProcess) {
            runningServers[job.projectId].tunnelProcess.kill();
          }
        }
        delete runningServers[job.projectId];
        await sendLog(job.id, "Server successfully stopped.");
      } catch (e) {
        console.error("Failed to kill process", e);
        await sendLog(job.id, \`Failed to kill process: \${e.message}\`);
      }
    } else {
       await sendLog(job.id, "No server running for this project.");
    }
    
    await fetch(\`\${backendUrl}/api/agents/complete\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, jobId: job.id, status: "Success" })
    });
    return;
  }
  
  const repo = job.repository;
  const rootDir = job.rootDir && job.rootDir !== './' ? job.rootDir : '.';
  const installCmd = job.installCommand || 'npm install';
  const buildCmd = job.buildCommand || 'npm run build';
  
  if (runningServers[job.projectId]) {
    await sendLog(job.id, "Stopping previous deployment server...");
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', runningServers[job.projectId].appProcess.pid, '/T', '/F']);
        if (runningServers[job.projectId].tunnelProcess) {
          spawn('taskkill', ['/pid', runningServers[job.projectId].tunnelProcess.pid, '/T', '/F']);
        }
      } else {
        runningServers[job.projectId].appProcess.kill();
        if (runningServers[job.projectId].tunnelProcess) {
          runningServers[job.projectId].tunnelProcess.kill();
        }
      }
    } catch (e) {
      console.error("Failed to kill old process", e);
    }
  }

  const repoDir = \`repo_\${job.id}\`;
  const cloneCmd = \`git clone \${repo} \${repoDir}\`;
  
  await sendLog(job.id, \`Starting job. Cloning repository...\`);
  
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

    const fs = require('fs');
    const path = require('path');
    const appDir = path.join(repoDir, rootDir);

    if (!fs.existsSync(appDir)) {
      await sendLog(job.id, \`Error: Root directory '\${rootDir}' not found\`);
      await fetch(\`\${backendUrl}/api/agents/complete\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, jobId: job.id, status: "Failed" })
      });
      return;
    }

    const hasPackageJson = fs.existsSync(path.join(appDir, 'package.json'));

    const getFreePort = () => new Promise((resolve) => {
      const net = require('net');
      const srv = net.createServer();
      srv.listen(0, () => {
        const port = srv.address().port;
        srv.close(() => resolve(port));
      });
    });

    const startApp = async () => {
      const port = await getFreePort();
      const portStr = port.toString();
      await sendLog(job.id, \`Starting application server on dynamically assigned port \${port}...\`);

      let appProcess;
      if (hasPackageJson) {
        const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
        const scripts = pkg.scripts || {};
        
        if (scripts.start) {
          appProcess = spawn('npm', ['start'], { cwd: appDir, shell: true, env: { ...process.env, PORT: portStr } });
        } else if (fs.existsSync(path.join(appDir, 'dist'))) {
          await sendLog(job.id, "Detected 'dist' output. Serving statically.");
          appProcess = spawn('npx', ['-y', 'serve', '-s', 'dist', '-l', portStr], { cwd: appDir, shell: true });
        } else if (fs.existsSync(path.join(appDir, 'build'))) {
          await sendLog(job.id, "Detected 'build' output. Serving statically.");
          appProcess = spawn('npx', ['-y', 'serve', '-s', 'build', '-l', portStr], { cwd: appDir, shell: true });
        } else if (scripts.preview) {
          await sendLog(job.id, "No start script found. Falling back to preview.");
          appProcess = spawn('npm', ['run', 'preview', '--', '--port', portStr], { cwd: appDir, shell: true, env: { ...process.env, PORT: portStr } });
        } else if (scripts.dev) {
          await sendLog(job.id, "No start script found. Falling back to dev server.");
          appProcess = spawn('npm', ['run', 'dev', '--', '--port', portStr], { cwd: appDir, shell: true, env: { ...process.env, PORT: portStr } });
        } else {
          await sendLog(job.id, "No scripts found. Serving root statically.");
          appProcess = spawn('npx', ['-y', 'serve', '-s', '.', '-l', portStr], { cwd: appDir, shell: true });
        }
      } else {
        appProcess = spawn('npx', ['-y', 'serve', '-s', '.', '-l', portStr], { 
          cwd: appDir, 
          shell: true 
        });
      }

      appProcess.stdout.on('data', (data) => console.log(\`[APP] \${data}\`));
      appProcess.stderr.on('data', (data) => console.error(\`[APP ERR] \${data}\`));

      const subdomainSlug = (job.projectName || job.projectId).toLowerCase().replace(/[^a-z0-9]/g, '');
      const customSubdomain = \`bravocloud-\${subdomainSlug}\`;

      const startTunnel = async (attempt = 1) => {
        await sendLog(job.id, \`Exposing server to internet via localtunnel (Attempt \${attempt}) on port \${port} with subdomain \${customSubdomain}...\`);
        const tunnelProcess = spawn('npx', ['-y', 'localtunnel', '--port', portStr, '--subdomain', customSubdomain], { shell: true });
        
        runningServers[job.projectId] = { appProcess, tunnelProcess };

        let urlReported = false;
        let tunnelOutput = "";

        tunnelProcess.stdout.on('data', async (data) => {
          const output = data.toString();
          tunnelOutput += output;
          console.log(\`[TUNNEL] \${output}\`);
          
          const match = tunnelOutput.match(/your url is:\\s*(https?:\\/\\/[^\\s]+)/);
          if (match && !urlReported) {
            urlReported = true;
            const publicUrl = match[1].trim();
            
            if (publicUrl.includes(customSubdomain) || attempt >= 10) {
              await sendLog(job.id, \`Tunnel established: \${publicUrl}\`);
              await sendLog(job.id, \`Job finished with status: Success\`);
              const localUrl = \`http://localhost:\${port}\`;
              
              await fetch(\`\${backendUrl}/api/agents/complete\`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, jobId: job.id, status: "Success", publicUrl, localUrl })
              });
            } else {
              await sendLog(job.id, \`Warning: loca.lt returned a random URL. The requested subdomain is likely in TIME_WAIT. Retrying in 5 seconds...\`);
              tunnelProcess.kill();
              setTimeout(() => startTunnel(attempt + 1), 5000);
            }
          }
        });

        tunnelProcess.stderr.on('data', (data) => {
          console.error(\`[TUNNEL ERR] \${data}\`);
        });
      };

      await startTunnel();
    };

    if (hasPackageJson) {
      const buildCmdStr = \`cd "\${appDir}" && \${installCmd} && \${buildCmd}\`;
      await sendLog(job.id, \`Found package.json. Running build commands...\`);
      exec(buildCmdStr, async (err, bStdout, bStderr) => {
        if (err) {
          console.error(\`build error: \${err}\`);
          await sendLog(job.id, \`Build Error: \${err.message}\`);
          if (bStdout) await sendLog(job.id, bStdout);
          if (bStderr) await sendLog(job.id, bStderr);
          await sendLog(job.id, \`Job finished with status: Failed\`);
          
          await fetch(\`\${backendUrl}/api/agents/complete\`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, jobId: job.id, status: "Failed" })
          });
          return;
        }
        if (bStdout) await sendLog(job.id, bStdout);
        await startApp();
      });
    } else {
      await sendLog(job.id, "No package.json detected. Treating as a static site.");
      await startApp();
    }
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
exports.default = router;
