#!/bin/bash
set -e

# Parse arguments
TOKEN=""
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --token) TOKEN="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$TOKEN" ]; then
    echo "Error: Missing --token argument."
    exit 1
fi

echo -e "\e[36mBravoCloud Linux/Mac Agent Installer\e[0m"
echo -e "\e[36m======================================\e[0m"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "\e[33mNode.js is not installed. Installing...\e[0m"
    if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo -e "\e[31mPlease install Node.js manually, then run this script again.\e[0m"
        exit 1
    fi
fi

AGENT_DIR="$HOME/.bravocloud-agent"
mkdir -p "$AGENT_DIR"

echo -e "\e[33mDownloading agent script...\e[0m"
BACKEND_URL="${BRAVOCLOUD_BACKEND_URL:-https://bravo-cloud-ydew.vercel.app}"
SCRIPT_URL="$BACKEND_URL/bravocloud-agent.js"
curl -sSL "$SCRIPT_URL" -o "$AGENT_DIR/bravocloud-agent.js"

echo -e "\e[32mAgent installed to $AGENT_DIR\e[0m"
echo -e "\e[33mStarting Agent...\e[0m"

cd "$AGENT_DIR"
node bravocloud-agent.js --token "$TOKEN"
