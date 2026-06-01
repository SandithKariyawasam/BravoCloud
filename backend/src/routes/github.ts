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
      per_page: 50
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

export default router;
