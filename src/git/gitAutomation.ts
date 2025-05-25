import { Octokit } from "@octokit/rest";
import type { Endpoints } from "@octokit/types";
import * as fs from "fs/promises";
import * as path from "path";

// Type definitions for API responses
type GitRef = Endpoints["GET /repos/{owner}/{repo}/git/ref/{ref}"]["response"];
type PullRequest = Endpoints["POST /repos/{owner}/{repo}/pulls"]["response"];

export interface PRConfig {
  owner: string;
  repo: string;
  baseBranch: string;
  newBranch: string;
  filePath: string[]; // now supports multiple files
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

export class GitHubPRCreator {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async createAutomatedPR(config: PRConfig): Promise<string> {
    try {
      console.log(`Creating PR from ${config.newBranch} to ${config.baseBranch} in ${config.owner}/${config.repo}`);

      // 1. Get base branch reference
      const baseRef = await this.getBaseRef(config);

      // 2. Create new branch
      await this.createBranch(config, baseRef.data.object.sha);

      // 3. Create commit with new files
      const commitSha = await this.createCommit(config, baseRef.data.object.sha);

      // 4. Create Pull Request
      const pr = await this.createPullRequest(config);

      return pr.data.html_url;
    } catch (error) {
      throw new Error(`🚨 PR creation failed: ${(error as Error).message}`);
    }
  }

  private async getBaseRef(config: PRConfig): Promise<GitRef> {
    return this.octokit.git.getRef({
      owner: config.owner,
      repo: config.repo,
      ref: `heads/${config.baseBranch}`,
    });
  }

  private async createBranch(config: PRConfig, baseSha: string): Promise<void> {
    await this.octokit.git.createRef({
      owner: config.owner,
      repo: config.repo,
      ref: `refs/heads/${config.newBranch}`,
      sha: baseSha,
    });
  }

  private async createCommit(config: PRConfig, baseSha: string): Promise<string> {
    const treeItems: Endpoints["POST /repos/{owner}/{repo}/git/trees"]["parameters"]["tree"] = [];

    for (const file of config.filePath) {
      const content = await fs.readFile(file, "utf-8");

      // Create blob
      const { data: blob } = await this.octokit.git.createBlob({
        owner: config.owner,
        repo: config.repo,
        content: Buffer.from(content).toString("base64"),
        encoding: "base64",
      });

      // Push to tree (just file name, no full path)
      treeItems.push({
        path: path.basename(file),
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    }

    // Create tree
    const { data: tree } = await this.octokit.git.createTree({
      owner: config.owner,
      repo: config.repo,
      tree: treeItems,
      base_tree: baseSha,
    });

    // Create commit
    const { data: commit } = await this.octokit.git.createCommit({
      owner: config.owner,
      repo: config.repo,
      message: config.commitMessage,
      tree: tree.sha,
      parents: [baseSha],
    });

    // Update branch reference
    await this.octokit.git.updateRef({
      owner: config.owner,
      repo: config.repo,
      ref: `heads/${config.newBranch}`,
      sha: commit.sha,
    });

    return commit.sha;
  }

  private async createPullRequest(config: PRConfig): Promise<PullRequest> {
    return this.octokit.pulls.create({
      owner: config.owner,
      repo: config.repo,
      title: config.prTitle,
      head: config.newBranch,
      base: config.baseBranch,
      body: config.prBody,
      maintainer_can_modify: true,
    });
  }
}
