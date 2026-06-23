param(
    [string]$token = ""
)

if (-not $token) {
    Write-Host "Error: Missing --token argument." -ForegroundColor Red
    exit 1
}

Write-Host "BravoCloud Windows Agent Installer" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Check for Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is not installed. Please install Node.js from https://nodejs.org first!" -ForegroundColor Red
    exit 1
}

$agentDir = "$env:APPDATA\BravoCloudAgent"
if (-not (Test-Path $agentDir)) {
    New-Item -ItemType Directory -Force -Path $agentDir | Out-Null
}

Write-Host "Downloading agent script..." -ForegroundColor Yellow

# Use BRAVOCLOUD_BACKEND_URL from env if available, else localhost for testing or prod
$backendUrl = [System.Environment]::GetEnvironmentVariable("BRAVOCLOUD_BACKEND_URL")
if (-not $backendUrl) {
    $backendUrl = "https://bravo-cloud-ydew.vercel.app"
    # To support local testing easily, we can replace this with localhost if running locally
    # But since they execute it from remote, it will pull from the remote URL.
}

$scriptUrl = "$backendUrl/bravocloud-agent.js"
$scriptPath = "$agentDir\bravocloud-agent.js"
Invoke-WebRequest -Uri $scriptUrl -OutFile $scriptPath

Write-Host "Agent installed to $agentDir" -ForegroundColor Green
Write-Host "Starting Agent in background..." -ForegroundColor Yellow

cd $agentDir
node bravocloud-agent.js --token $token
