import * as fs from "fs-extra";
import * as path from "path";
import { parseExcel } from "./parser/excelParser";
import { generateXMLFiles } from "./generator/xmlGenerator";
import { runGitAutomation } from "./git/gitAutomation";

export async function processExcelFile(filePath: string): Promise<any> {
  const { data,groupedInserts,groupedUpdates, errors, skipped } = await parseExcel(filePath);

  const outputPaths = await generateXMLFiles(groupedInserts,data,groupedUpdates);

  // if (outputPaths.length > 0) {
  //   const outputDir = path.dirname(outputPaths[0]); // Get the folder of the first XML file
  //   const filesInOutput = await fs.readdir(outputDir).catch(() => []);
  //   console.log("Files in local output folder after XML generation:", filesInOutput);

  //   if (filesInOutput.length > 0) {
  //     // await runGitAutomation(); // ✅ pass the real output directory here
  //     // automateGitProcess()
  //   } else {
  //     console.log("⚠️ XML files generated but none found in the output directory, skipping PR creation.");
  //   }
  // } else {
  //   console.log("⚠️ No XML files generated, skipping PR creation.");
  // }

  return { data, errors, skipped };
}