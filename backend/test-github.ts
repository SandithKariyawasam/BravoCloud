import { prisma } from './src/lib/prisma';
import { commitProjectFiles } from './src/lib/github';
import { Octokit } from '@octokit/rest';

async function test() {
  try {
    const user = await prisma.user.findFirst();
    if (!user || !user.githubToken) return;

    const octokit = new Octokit({ auth: user.githubToken });
    const owner = 'SandithKariyawasam';
    const repo = 'BravoCloud';
    const branch = 'dev';

    const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
    const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: refData.object.sha });
    
    console.log('Base tree SHA:', latestCommit.tree.sha);

    const { data: blob1 } = await octokit.git.createBlob({ owner, repo, content: 'A', encoding: 'utf-8' });
    const { data: blob2 } = await octokit.git.createBlob({ owner, repo, content: 'B', encoding: 'utf-8' });

    console.log('Blob1:', blob1.sha);
    console.log('Blob2:', blob2.sha);

    const treeArray = [
      { path: 'frontend/Dockerfile', mode: '100644' as const, type: 'blob' as const, sha: blob1.sha },
      { path: '.github/workflows/bravocloud.yml', mode: '100644' as const, type: 'blob' as const, sha: blob2.sha }
    ];

    try {
      const { data: newTree } = await octokit.git.createTree({
        owner,
        repo,
        base_tree: latestCommit.tree.sha,
        tree: treeArray
      });
      console.log('Tree created:', newTree.sha);
    } catch (e: any) {
      console.log('Failed tree with base_tree:', e.message);
      
      // Try without base_tree
      try {
        console.log('Trying WITHOUT base_tree...');
        const { data: newTree2 } = await octokit.git.createTree({
          owner,
          repo,
          tree: treeArray
        });
        console.log('Tree created without base_tree:', newTree2.sha);
      } catch (e2: any) {
        console.log('Failed tree WITHOUT base_tree:', e2.message);
      }
    }
  } catch (error: any) {
    console.error('API Error:', error.message);
  }
}

test();
