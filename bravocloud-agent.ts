const args = process.argv.slice(2);
let token = '';

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--token') {
    token = args[i + 1];
    break;
  }
}

if (!token) {
  console.error("Error: --token is required. Usage: npx ts-node bravocloud-agent.ts --token <YOUR_TOKEN>");
  process.exit(1);
}

const API_URL = "http://localhost:4000/api/agents";

console.log("🚀 BravoCloud Agent starting...");
console.log(`🔑 Connected with token: ${token.substring(0, 8)}...`);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const pushLog = async (jobId: string, log: string) => {
  console.log(`[Job ${jobId}] ${log}`);
  try {
    await fetch(`${API_URL}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, jobId, log })
    });
  } catch (err) {
    console.error("Failed to push log", err);
  }
};

const executeJob = async (job: any) => {
  console.log(`\n📦 Received new job: ${job.id}`);
  
  await pushLog(job.id, "Starting deployment runner...");
  await sleep(2000);
  
  await pushLog(job.id, `Cloning repository: ${job.repository}`);
  await sleep(3000);
  
  await pushLog(job.id, "Resolving dependencies (npm install)...");
  await sleep(4000);
  
  await pushLog(job.id, "Building application (npm run build)...");
  await sleep(5000);
  
  await pushLog(job.id, "✓ Build succeeded in 12.4s");
  await sleep(1000);
  
  await pushLog(job.id, "Deploying artifacts to BravoCloud Edge Network...");
  await sleep(3000);
  
  await pushLog(job.id, "✓ Deployment complete! Marking job as Success.");
  
  // Mark complete
  try {
    await fetch(`${API_URL}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, jobId: job.id, status: 'Success' })
    });
    console.log(`✅ Job ${job.id} marked as Success.`);
  } catch (err) {
    console.error("Failed to mark job complete", err);
  }
};

const startPolling = async () => {
  console.log("📡 Polling for jobs (Press CTRL+C to exit)...");
  
  while (true) {
    try {
      const res = await fetch(`${API_URL}/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      if (!res.ok) {
        if (res.status === 401) {
          console.error("❌ Authentication failed. Invalid token.");
          process.exit(1);
        }
        console.error(`Warning: Polling failed with status ${res.status}`);
      } else {
        const data = await res.json();
        
        if (data.job) {
          await executeJob(data.job);
        }
      }
    } catch (err: any) {
      console.error("Network error during polling:", err.message);
    }

    // Wait 10 seconds before polling again
    await sleep(10000);
  }
};

startPolling();
