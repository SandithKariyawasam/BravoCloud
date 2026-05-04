"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commitProjectFiles = commitProjectFiles;
exports.setupRepositorySecrets = setupRepositorySecrets;
const rest_1 = require("@octokit/rest");
/**
 * Commits multiple files to a GitHub repository in a single commit using the Git Database API.
 */
async function commitProjectFiles(token, owner, repo, files, branch = 'main', message = 'Add BravoCloud configuration') {
    const octokit = new rest_1.Octokit({ auth: token });
    // 1. Get current branch reference
    const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
    const latestCommitSha = refData.object.sha;
    // 2. Get the commit to get its tree
    const { data: latestCommit } = await octokit.git.getCommit({
        owner,
        repo,
        commit_sha: latestCommitSha
    });
    const baseTreeSha = latestCommit.tree.sha;
    // 3. Create blobs and form the tree array
    const treeArray = [];
    for (const file of files) {
        const { data: blobData } = await octokit.git.createBlob({
            owner,
            repo,
            content: file.content,
            encoding: 'utf-8'
        });
        treeArray.push({
            path: file.path,
            mode: '100644',
            type: 'blob',
            sha: blobData.sha
        });
    }
    // 4. Create new tree
    const { data: newTree } = await octokit.git.createTree({
        owner,
        repo,
        base_tree: baseTreeSha,
        tree: treeArray
    });
    // 5. Create new commit
    const { data: newCommit } = await octokit.git.createCommit({
        owner,
        repo,
        message,
        tree: newTree.sha,
        parents: [latestCommitSha]
    });
    // 6. Update reference
    await octokit.git.updateRef({
        owner,
        repo,
        ref: refData.ref.replace('refs/', ''),
        sha: newCommit.sha
    });
    return newCommit;
}
const libsodium_wrappers_1 = __importDefault(require("libsodium-wrappers"));
/**
 * Automagically injects AWS secrets into the user's GitHub repository.
 */
async function setupRepositorySecrets(token, owner, repo, secrets) {
    const octokit = new rest_1.Octokit({ auth: token });
    // 1. Get the repository's public key for Action Secrets
    const { data: publicKeyData } = await octokit.rest.actions.getRepoPublicKey({
        owner,
        repo,
    });
    // 2. Wait for sodium to be ready
    await libsodium_wrappers_1.default.ready;
    const binkey = libsodium_wrappers_1.default.from_base64(publicKeyData.key, libsodium_wrappers_1.default.base64_variants.ORIGINAL);
    // 3. Encrypt and upload each secret
    for (const [secretName, secretValue] of Object.entries(secrets)) {
        const binsec = libsodium_wrappers_1.default.from_string(secretValue);
        const encBytes = libsodium_wrappers_1.default.crypto_box_seal(binsec, binkey);
        const encryptedValue = libsodium_wrappers_1.default.to_base64(encBytes, libsodium_wrappers_1.default.base64_variants.ORIGINAL);
        await octokit.rest.actions.createOrUpdateRepoSecret({
            owner,
            repo,
            secret_name: secretName,
            encrypted_value: encryptedValue,
            key_id: publicKeyData.key_id,
        });
    }
}
