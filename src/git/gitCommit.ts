import { execSync } from "child_process";
import axios from "axios";

// Environment variables and constants
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Use environment variable
const BASE_BRANCH = "main"; // Target branch
const owner = process.env.GITHUB_OWNER || "hmehrotr"; // Configurable owner
const repo = process.env.GITHUB_REPO || "1iquibaseXmlTool"; // Configurable repo

export async function automateGitProcess() {
  try {
    // Stage and commit changes
    execSync("git add .");
    execSync('git commit -m "Auto-commit: New generated files"');

    // Create a new branch
    const branchName = `auto-update-${Date.now()}`;
    execSync(`git checkout -b ${branchName}`);
    execSync(`git push -u origin ${branchName}`);

    // Create GitHub API client
    const github = axios.create({
      baseURL: "https://api.github.com",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
      },
    });

    // Create pull request
    const { data: pr } = await github.post(`/repos/${owner}/${repo}/pulls`, {
      title: "Generated XML files",
      head: branchName,
      base: BASE_BRANCH,
      body: "This PR was created automatically",
    });

    console.log("Pull request created:", pr.html_url);
  } catch (error) {
    console.error("Error creating pull request:", error);
  }
}