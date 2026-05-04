import { Router } from 'express';
import { Octokit } from '@octokit/rest';

const router = Router();

const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated() || !req.user?.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

router.get('/repos', requireAuth, async (req: any, res: any) => {
  try {
    const octokit = new Octokit({ auth: req.user.accessToken });
    
    const response = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 50,
      affiliation: 'owner'
    });
    
    const simplifiedRepos = response.data.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      htmlUrl: repo.html_url,
      description: repo.description,
      language: repo.language,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at
    }));

    res.json({ repos: simplifiedRepos });
  } catch (error: any) {
    console.error('Error fetching GitHub repos:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

router.get('/repos/:owner/:repo/branches', requireAuth, async (req: any, res: any) => {
  try {
    const { owner, repo } = req.params;
    const octokit = new Octokit({ auth: req.user.accessToken });
    
    const response = await octokit.rest.repos.listBranches({
      owner,
      repo,
      per_page: 100
    });
    
    const branches = response.data.map((branch: any) => ({
      name: branch.name,
      commitSha: branch.commit.sha,
      protected: branch.protected
    }));

    res.json({ branches });
  } catch (error: any) {
    console.error(`Error fetching branches for ${req.params.owner}/${req.params.repo}:`, error);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

router.get('/repos/:owner/:repo/branches/:branch/directories', requireAuth, async (req: any, res: any) => {
  try {
    const { owner, repo, branch } = req.params;
    const octokit = new Octokit({ auth: req.user.accessToken });
    
    // First, get the commit SHA for the branch
    const branchData = await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch
    });
    const treeSha = branchData.data.commit.commit.tree.sha;

    // Then, get the recursive tree
    const treeData = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: "1"
    });
    
    // Filter out only directories (type: "tree")
    const directories = treeData.data.tree
      .filter((item: any) => item.type === 'tree')
      .map((item: any) => `./${item.path}`);

    // Always include root
    directories.unshift('./');

    res.json({ directories });
  } catch (error: any) {
    console.error(`Error fetching directories for ${req.params.owner}/${req.params.repo}:`, error);
    res.status(500).json({ error: 'Failed to fetch directory structure' });
  }
});

router.get('/repos/:owner/:repo/branches/:branch/contents', requireAuth, async (req: any, res: any) => {
  try {
    const { owner, repo, branch } = req.params;
    const { path } = req.query; // e.g. "frontend/package.json" or "package.json"
    
    if (!path) {
      return res.status(400).json({ error: 'Path query parameter is required' });
    }

    const octokit = new Octokit({ auth: req.user.accessToken });
    
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: path as string,
      ref: branch
    });

    // If it's a file, it will have 'content' and 'encoding' (base64)
    if (!Array.isArray(data) && data.type === 'file' && data.content) {
      const decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
      return res.json({ content: decodedContent });
    }

    res.status(404).json({ error: 'Not a file or not found' });
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'File not found' });
    }
    console.error(`Error fetching file content for ${req.params.owner}/${req.params.repo}:`, error);
    res.status(500).json({ error: 'Failed to fetch file content' });
  }
});

export default router;
