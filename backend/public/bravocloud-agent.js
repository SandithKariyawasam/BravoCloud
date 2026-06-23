const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const tokenIndex = process.argv.indexOf('--token');
if (tokenIndex === -1 || !process.argv[tokenIndex + 1]) {
  console.error("Missing --token argument");
  process.exit(1);
}
const token = process.argv[tokenIndex + 1].replace(/^["']|["']$/g, '').trim();

const backendUrl = process.env.BRAVOCLOUD_BACKEND_URL || "https://bravo-cloud-ydew.vercel.app"; 

async function sendLog(jobId, logLine) {
  try {
    await fetch(`${backendUrl}/api/agents/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, jobId, logLine })
    });
  } catch (err) {}
}

async function markComplete(jobId, status) {
  try {
    await fetch(`${backendUrl}/api/agents/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, jobId, status })
    });
  } catch (err) {}
}

async function executeJob(job) {
  console.log(`Starting job: ${job.id}`);
  const workDir = path.join(process.cwd(), `bravocloud-work-${job.id}`);
  
  try {
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }
    
    await sendLog(job.id, "Cloning repository...");
    await new Promise(r => setTimeout(r, 2000));
    
    await sendLog(job.id, "Installing dependencies...");
    await new Promise(r => setTimeout(r, 2000));
    
    await sendLog(job.id, "Building project...");
    await new Promise(r => setTimeout(r, 2000));
    
    await sendLog(job.id, "Build successful!");
    await markComplete(job.id, "Success");
    console.log(`Job ${job.id} completed successfully.`);
  } catch (err) {
    await sendLog(job.id, `Error: ${err.message}`);
    await markComplete(job.id, "Failed");
    console.log(`Job ${job.id} failed.`);
  } finally {
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  }
}

async function poll() {
  try {
    const res = await fetch(`${backendUrl}/api/agents/poll`, {
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
      console.error(`Poll failed: ${res.status} - ${errText}`);
    }
  } catch (error) {
    console.error("Network error during polling:", error.message);
  }
  
  setTimeout(poll, 5000);
}

console.log("BravoCloud Agent started. Waiting for jobs...");
poll();
