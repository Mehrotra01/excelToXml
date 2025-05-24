import { parseExcel } from "./parser/excelParser";
import { generateXMLFile } from "./generator/xmlGenerator";
import { commitAndPushChanges } from "./git/gitAutomation";

export async function processExcelFile(filePath:string):Promise<void> {
    console.log(`processing: ${filePath}`)

    const rows = await parseExcel(filePath);
    await generateXMLFile(rows);
    await commitAndPushChanges('Auto-commit: XMLs generated from Excel');
    console.log('process completed')
}