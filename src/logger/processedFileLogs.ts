import fs from "fs-extra";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE_PATH = path.resolve(__dirname, "../../output/processed-files.log");

export async function hasFileBeenProcessed(fileName: string): Promise<boolean> {
  try {
    await fs.ensureFile(LOG_FILE_PATH);
    const logContent = await fs.readFile(LOG_FILE_PATH, "utf8");
    return logContent.split("\n").includes(fileName);
  } catch (error) {
    console.error("Logger check failed:", error);
    return false;
  }
}

export async function markFileAsProcessed(fileName: string): Promise<void> {
  try {
    await fs.ensureFile(LOG_FILE_PATH);
    await fs.appendFile(LOG_FILE_PATH, `${fileName}\n`);
  } catch (error) {
    console.error("Failed to mark file as processed:", error);
  }
}
