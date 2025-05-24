import { parseExcel } from "./parser/excelParser";
import { generateXMLFile } from "./generator/xmlGenerator";
import { commitAndPushXML, createPullRequest } from "./git/gitAutomation";

export async function processExcelFile(filePath: string): Promise<void> {

  const rows = await parseExcel(filePath);
  await generateXMLFile(rows);

  const branchName = `auto/form-PR-From-Excel`;
  const commitMessage = "feat: add Liquibase XML from uploaded Excel";
  
  await commitAndPushXML(branchName, commitMessage);
  
  const prTitle = "Auto PR: Liquibase change set XML";
  const prUrl = await createPullRequest(branchName, prTitle);
  console.log("✅ Pull request created:", prUrl);
}
