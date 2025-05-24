import simpleGit from "simple-git";
import { Octokit } from "@octokit/rest";
import path from "path";
import fs from "fs-extra";
import dotenv from "dotenv";

dotenv.config();
const git = simpleGit();
const outputFolder = path.resolve(__dirname, "../../output");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const REPO_OWNER = "Mehrotra01";
const REPO_NAME = "excelToXml";
const BASE_BRANCH = "master";

export async function commitAndPushXML(
  branchName: string,
  commitMessage: string
) {
  try {
    const branchExists = (await git.branch()).all.includes(
      `remotes/origin/${branchName}`
    );

    // Create or switch to branch
    if (branchExists) {
      await git.checkout(branchName);
    } else {
      await git.checkoutBranch(branchName, BASE_BRANCH);
    }

    // Ensure output folder exists
    const exists = await fs.pathExists(outputFolder);
    if (!exists) {
      console.log("❌ Output folder does not exist.");
      return;
    }

    // Get all file paths in output folder
    const files = (await fs.readdir(outputFolder)).filter(async (file) => {
      const fullPath = path.join(outputFolder, file);
      return (await fs.stat(fullPath)).isFile();
    });

    if (files.length === 0) {
      console.log("⚠️ No files found in output folder.");
      return;
    }

    // Git needs paths relative to project root
    const filePaths = files.map((file) =>
      path.relative(process.cwd(), path.join(outputFolder, file))
    );

    await git.add(filePaths);
    await git.commit(commitMessage);
    await git.push("origin", branchName);

    console.log(
      `✅ ${files.length} file(s) committed and pushed to ${branchName}`
    );
  } catch (err) {
    console.error("🚨 Git operation failed:", err);
  }
}

export async function createPullRequest(
  branchName: string,
  title: string,
  body = "",
  reviewers: string[] = []
) {
  try {
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    const { data: pr } = await octokit.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title,
      head: branchName,
      base: BASE_BRANCH,
      body,
    });

    console.log(`🔃 Pull Request created: ${pr.html_url}`);

    if (reviewers.length > 0) {
      await octokit.pulls.requestReviewers({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        pull_number: pr.number,
        reviewers,
      });

      console.log(`🙋 Reviewers added: ${reviewers.join(", ")}`);
    }

    return pr.html_url;
  } catch (err) {
    console.error("🚨 PR creation failed:", err);
    return null;
  }
}
