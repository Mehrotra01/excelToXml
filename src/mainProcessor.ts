import { parseExcel } from "./parser/excelParser";
import { generateXMLFile } from "./generator/xmlGenerator";
import { GitHubPRCreator, PRConfig } from "./git/gitAutomation";
import dotenv from "dotenv";

dotenv.config();
export async function processExcelFile(filePath: string): Promise<any> {

  const {data,errors} = await parseExcel(filePath);
  const outputPath = await generateXMLFile(data);

  // Usage
const prConfig: PRConfig = {
  owner: "Mehrotra01",
  repo: "excelToXml",
  baseBranch: "master",
  newBranch: `auto/form-${new Date}`,
  filePath: outputPath,
  commitMessage: "feat: add Liquibase XML from uploaded Excel",
  prTitle: "Auto PR: Liquibase change set XML",
  prBody: "Please pull these awesome changes in!"
};
// console.log(process.env.GITHUB_TOKEN)

// const prCreator = new GitHubPRCreator(process.env.GITHUB_TOKEN || "your-token");
// prCreator.createAutomatedPR(prConfig)
//   .then(prUrl => console.log(`PR Created: ${prUrl}`))
//   .catch(error => console.error(error));
  return {data,errors};
}
