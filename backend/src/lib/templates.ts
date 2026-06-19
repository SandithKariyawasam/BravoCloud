export function generateDockerfile(framework: string, installCmd?: string, buildCmd?: string, outputDir?: string): string {
  const normalized = framework.toLowerCase();
  
  const finalInstallCmd = installCmd || 'if [ -f package-lock.json ]; then npm ci; elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; else npm install; fi';
  const finalBuildCmd = buildCmd || 'npm run build';

  if (normalized.includes('next.js')) {
    return `# Next.js Dockerfile
FROM public.ecr.aws/docker/library/node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN ${finalInstallCmd}

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN ${finalBuildCmd}

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
`;
  }

  if (normalized.includes('react') || normalized.includes('vite') || normalized.includes('vue') || normalized.includes('svelte') || normalized.includes('angular')) {
    const finalOutputDir = outputDir || 'dist';
    return `# Static Site Dockerfile
FROM public.ecr.aws/docker/library/node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN ${finalInstallCmd}
COPY . .
RUN ${finalBuildCmd}
RUN if [ -d "${finalOutputDir}" ]; then mv ${finalOutputDir} _bravocloud_out; elif [ -d "dist" ]; then mv dist _bravocloud_out; elif [ -d "build" ]; then mv build _bravocloud_out; else mkdir _bravocloud_out; fi

FROM public.ecr.aws/docker/library/nginx:alpine
COPY --from=builder /app/_bravocloud_out /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
  }

  if (normalized.includes('python') || normalized.includes('django') || normalized.includes('flask') || normalized.includes('fastapi')) {
    const pyInstallCmd = installCmd || 'pip install --no-cache-dir -r requirements.txt';
    // For python, build command might be optional, but if specified, run it
    const pyBuildStep = buildCmd ? `RUN ${buildCmd}` : '';
    return `# Python Dockerfile
FROM public.ecr.aws/docker/library/python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN ${pyInstallCmd}
COPY . .
${pyBuildStep}
EXPOSE 8000
CMD ["python", "main.py"]
`;
  }

  // Generic Node fallback
  return `# Generic Node.js Dockerfile
FROM public.ecr.aws/docker/library/node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN ${finalInstallCmd}
COPY . .
${buildCmd ? `RUN ${buildCmd}` : ''}
EXPOSE 3000
CMD ["npm", "start"]
`;
}

export function generateWorkflow(webhookUrl: string, projectId: string, deploymentId: string, ecrUri: string, branch: string = "main", rootDir: string = "./"): string {
  // Extract region from ECR URI (e.g. 123456789012.dkr.ecr.us-east-1.amazonaws.com/repo)
  const ecrRegionMatch = ecrUri.match(/\.ecr\.([a-z0-9-]+)\.amazonaws\.com/);
  const awsRegion = ecrRegionMatch ? ecrRegionMatch[1] : 'us-east-1';

  return `name: BravoCloud Deployment

on:
  push:
    branches:
      - ${branch}

jobs:
  build-and-notify:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${awsRegion}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push Docker image to Amazon ECR
        env:
          ECR_REGISTRY: \${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: ${ecrUri.split('/').pop()}
          IMAGE_TAG: \${{ github.sha }}
        run: |
          cd ${rootDir}
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          # Also tag as latest
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Notify BravoCloud Success
        if: success()
        run: |
          curl -X POST -H "Content-Type: application/json" \\
          -d '{"projectId": "${projectId}", "deploymentId": "${deploymentId}", "status": "SUCCESS", "commitHash": "'"\${GITHUB_SHA}"'"}' \\
          ${webhookUrl}

      - name: Notify BravoCloud Failure
        if: failure()
        run: |
          curl -X POST -H "Content-Type: application/json" \\
          -d '{"projectId": "${projectId}", "deploymentId": "${deploymentId}", "status": "FAILED", "commitHash": "'"\${GITHUB_SHA}"'"}' \\
          ${webhookUrl}
`;
}
