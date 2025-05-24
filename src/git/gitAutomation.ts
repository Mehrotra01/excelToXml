import simpleGit from 'simple-git';
import { Octokit } from '@octokit/rest';

const git = simpleGit();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const REPO_OWNER = 'Mehrotra01';
const REPO_NAME = 'excelToXml';
const BASE_BRANCH = 'master';

export async function commitAndPushXML(filePath: string, branchName: string, commitMessage: string) {
  const branchExists = (await git.branch()).all.includes(`remotes/origin/${branchName}`);
  
  // Create or checkout branch
  if (branchExists) {
    await git.checkout(branchName);
  } else {
    await git.checkoutBranch(branchName, BASE_BRANCH);
  }

  await git.add(filePath);
  await git.commit(commitMessage);
  await git.push('origin', branchName);
}

export async function createPullRequest(branchName: string, title: string, body = '') {
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  const { data: pr } = await octokit.pulls.create({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    title,
    head: branchName,
    base: BASE_BRANCH,
    body,
  });

  return pr.html_url;
}
