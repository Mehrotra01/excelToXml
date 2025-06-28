import * as dotenv from "dotenv";
import simpleGit, { SimpleGit } from "simple-git";
import * as fs from "fs-extra";
import * as path from "path";
import { Octokit } from "@octokit/rest";

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const REVIEWERS: string[] = []; // 👉 add reviewers if needed

const TEMP_DIR = path.resolve("./temp-clone");

export async function runGitAutomation(outputDir: string): Promise<void> {
  console.log("Checking .env variables...");
  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
    console.error(
      "❌ Missing .env variables! Please check GITHUB_TOKEN, REPO_OWNER, and REPO_NAME."
    );
    process.exit(1);
  }

  const BRANCH_NAME = `auto/pr-${Date.now()}`;
  const git: SimpleGit = simpleGit();
  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const repoUrl = `https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO_OWNER}/${REPO_NAME}.git`;

  console.log("Cleaning up any existing temp clone...");
  await fs.remove(TEMP_DIR);

  console.log("Using repo URL:", repoUrl);

  console.log("Cloning target repo...");
  try {
    await git.clone(repoUrl, TEMP_DIR);
  } catch (err) {
    console.error("❌ Git clone failed:", (err as Error).message);
    process.exit(1);
  }

  const repoGit: SimpleGit = simpleGit(TEMP_DIR);
  await repoGit.checkoutLocalBranch(BRANCH_NAME);

  console.log("Updating remote URL with token for authenticated push...");
  try {
    await repoGit.raw(["remote", "set-url", "origin", repoUrl]);
  } catch (err) {
    console.error("❌ Updating remote URL failed:", (err as Error).message);
    process.exit(1);
  }

  const LOCAL_OUTPUT_DIR = path.resolve(outputDir);
  const TARGET_OUTPUT_DIR = path.join(TEMP_DIR, "output");

  console.log(`Ensuring local output folder exists: ${LOCAL_OUTPUT_DIR}`);
  if (!(await fs.pathExists(LOCAL_OUTPUT_DIR))) {
    console.log(`⚠️ Local output folder '${LOCAL_OUTPUT_DIR}' does not exist; skipping PR creation.`);
    return;
  }

  const localFiles = await fs.readdir(LOCAL_OUTPUT_DIR);
  console.log("Files detected in local output:", localFiles);

  const xmlFiles = localFiles.filter(
    (f) => f.endsWith(".xml") && !f.includes(".git")
  );

  if (xmlFiles.length === 0) {
    console.log("✅ No XML files to copy; skipping commit & PR creation.");
    return;
  }

  console.log(`Found ${xmlFiles.length} XML files:`, xmlFiles);

  console.log(`Ensuring target directory exists: ${TARGET_OUTPUT_DIR}`);
  await fs.ensureDir(TARGET_OUTPUT_DIR);

  console.log("Copying XML files to cloned repo...");
  for (const file of xmlFiles) {
    const src = path.join(LOCAL_OUTPUT_DIR, file);
    const dest = path.join(TARGET_OUTPUT_DIR, file);
    console.log(`Copying ${src} -> ${dest}`);
    await fs.copy(src, dest);
  }

  console.log("Removing any submodule reference to 'output' if exists...");
  try {
    await repoGit.subModule(["deinit", "-f", "output"]);
    await repoGit.rm(["-rf", "output"]);
    await fs.remove(path.join(TEMP_DIR, ".gitmodules"));
    await repoGit.raw(["config", "-f", ".git/config", "--remove-section", "submodule.output"]);
    console.log("✅ Submodule 'output' removed if it existed.");
  } catch (e) {
    console.log("ℹ️ No submodule cleanup needed or already clean.");
  }

  const copiedFiles = await fs.readdir(TARGET_OUTPUT_DIR).catch(() => []);
  console.log("Copied XML files in cloned repo output folder:", copiedFiles);

  if (copiedFiles.length === 0) {
    console.log("✅ No XML files copied into cloned repo; skipping commit & PR creation.");
    return;
  }

  console.log("Staging XML files for git...");
  await repoGit.add("output/*.xml"); // Path relative to cloned repo root

  const status = await repoGit.status();
  console.log("Git status after staging:", status);

 if (
  status.not_added.length === 0 &&
  status.modified.length === 0 &&
  status.created.length === 0 &&
  status.renamed.length === 0
) {
  console.log("✅ No new, modified, or renamed XML files found; skipping commit & PR creation.");
  return;
}

console.log(
  `Detected changes: Added(${status.not_added.length}), Modified(${status.modified.length}), Created(${status.created.length}), Renamed(${status.renamed.length})`
);

  console.log(
    `Detected changes: Added(${status.not_added.length}), Modified(${status.modified.length}), Created(${status.created.length})`
  );

  console.log("Committing files...");
  await repoGit.commit("Automated Liquibase XML file update");

  console.log(`Pushing branch ${BRANCH_NAME}...`);
  try {
    await repoGit.push("origin", BRANCH_NAME);
  } catch (err) {
    console.error("❌ Git push failed:", (err as Error).message);
    process.exit(1);
  }

  console.log("Fetching default branch...");
  const repo = await octokit.repos.get({
    owner: REPO_OWNER,
    repo: REPO_NAME,
  });
  const defaultBranch = repo.data.default_branch;
  console.log(`Default branch is ${defaultBranch}`);

  console.log("Checking for existing open PRs from this branch...");
  const existingPRs = await octokit.pulls.list({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    head: `${REPO_OWNER}:${BRANCH_NAME}`,
    state: "open",
  });
  if (existingPRs.data.length > 0) {
    console.log(
      `🚨 A PR already exists for branch '${BRANCH_NAME}': ${existingPRs.data[0].html_url}`
    );
    return;
  }

  console.log("Creating PR on GitHub...");
  try {
    const pr = await octokit.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: "Automated PR: Liquibase XML updates",
      head: BRANCH_NAME,
      base: defaultBranch,
      body: "This PR was created automatically by the Liquibase XML generator tool.",
    });

    console.log(`✅ PR Created: ${pr.data.html_url}`);

    if (REVIEWERS.length > 0) {
      console.log(`Requesting reviewers: ${REVIEWERS.join(", ")}`);
      await octokit.pulls.requestReviewers({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        pull_number: pr.data.number,
        reviewers: REVIEWERS,
      });
      console.log("✅ Reviewers requested successfully.");
    }
  } catch (err) {
    console.error("❌ PR creation or reviewer request failed:", (err as Error).message);
    process.exit(1);
  }
}
