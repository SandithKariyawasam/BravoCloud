"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rest_1 = require("@octokit/rest");
const router = (0, express_1.Router)();
const middleware_1 = require("../lib/middleware");
router.get('/repos', middleware_1.verifyToken, async (req, res) => {
    try {
        const octokit = new rest_1.Octokit({ auth: req.user.accessToken });
        const response = await octokit.rest.repos.listForAuthenticatedUser({
            sort: 'updated',
            per_page: 50,
            affiliation: 'owner'
        });
        const simplifiedRepos = response.data.map((repo) => ({
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
    }
    catch (error) {
        console.error('Error fetching GitHub repos:', error);
        res.status(500).json({ error: 'Failed to fetch repositories' });
    }
});
router.get('/repos/:owner/:repo/branches', middleware_1.verifyToken, async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const octokit = new rest_1.Octokit({ auth: req.user.accessToken });
        const response = await octokit.rest.repos.listBranches({
            owner,
            repo,
            per_page: 100
        });
        const branches = response.data.map((branch) => ({
            name: branch.name,
            commitSha: branch.commit.sha,
            protected: branch.protected
        }));
        res.json({ branches });
    }
    catch (error) {
        console.error(`Error fetching branches for ${req.params.owner}/${req.params.repo}:`, error);
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
});
router.get('/repos/:owner/:repo/branches/:branch/directories', middleware_1.verifyToken, async (req, res) => {
    try {
        const { owner, repo, branch } = req.params;
        const octokit = new rest_1.Octokit({ auth: req.user.accessToken });
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
            .filter((item) => item.type === 'tree')
            .map((item) => `./${item.path}`);
        // Always include root
        directories.unshift('./');
        res.json({ directories });
    }
    catch (error) {
        console.error(`Error fetching directories for ${req.params.owner}/${req.params.repo}:`, error);
        res.status(500).json({ error: 'Failed to fetch directory structure' });
    }
});
router.get('/repos/:owner/:repo/branches/:branch/contents', middleware_1.verifyToken, async (req, res) => {
    try {
        const { owner, repo, branch } = req.params;
        const { path } = req.query; // e.g. "frontend/package.json" or "package.json"
        if (!path) {
            return res.status(400).json({ error: 'Path query parameter is required' });
        }
        const octokit = new rest_1.Octokit({ auth: req.user.accessToken });
        const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: path,
            ref: branch
        });
        // If it's a file, it will have 'content' and 'encoding' (base64)
        if (!Array.isArray(data) && data.type === 'file' && data.content) {
            const decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
            return res.json({ content: decodedContent });
        }
        res.status(404).json({ error: 'Not a file or not found' });
    }
    catch (error) {
        if (error.status === 404) {
            return res.status(404).json({ error: 'File not found' });
        }
        console.error(`Error fetching file content for ${req.params.owner}/${req.params.repo}:`, error);
        res.status(500).json({ error: 'Failed to fetch file content' });
    }
});
exports.default = router;
