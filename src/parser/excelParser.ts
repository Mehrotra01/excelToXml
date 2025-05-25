import ExcelJS from "exceljs";
import { inputRowSchema } from "../validation/schema";
import { InputRow } from "../types/inputRow";
import { ZodError } from "zod";
import { hasFileBeenProcessed } from "../logger/processedFileLogs";
import { formatDate, formatZodError } from "../utils/formating";
import { parseLooseJson } from "../utils/formating";

export async function parseExcel(filePath: string): Promise<InputRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet(1);

  const rows: InputRow[] = [];
  const failedRows: { rowNumber: number; error: string; values: any[] }[] = [];

  if (!worksheet) {
    throw new Error("Worksheet 'Sheet1' not found in the Excel file.");
  }

  // Use for...of to support async/await properly
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);

    if (!Array.isArray(row.values)) {
      console.warn(`Row ${rowNumber} is not an array, skipping.`);
      continue;
    }

    const values = row.values.slice(1);
    const [
      fileName,
      changeSetId,
      formNbr,
      formName,
      editionDt,
      lclPrtEle,
      optInd,
      msrInd,
      mnlAmdInd,
      pullLstInd,
      effectiveDate,
      expirationDate,
      lob,
      rcpType,
      srtKey,
    ] = values;

    try {
      const formattedRow = {
        fileName: fileName,
        changeSetId: changeSetId,
        formNbr: formNbr,
        formName: formName,
        editionDt: editionDt,
        lclPrtEle: lclPrtEle,
        optInd: optInd,
        msrInd: msrInd,
        mnlAmdInd: mnlAmdInd,
        pullLstInd: pullLstInd,
        effectiveDate: formatDate(effectiveDate),
        expirationDate: formatDate(expirationDate),
        lob: lob,
        rcpType: String(rcpType || "")
          .split(",")
          .map((str) => str.trim())
          .filter(Boolean),
        srtKey: parseLooseJson(srtKey),
      };

      const validatedRow = inputRowSchema.parse(formattedRow);

      const alreadyProcessed = await hasFileBeenProcessed(String(fileName+"-"+formNbr || ""));
      if (alreadyProcessed) {
        throw new Error(`⚠️ File "${fileName+"-"+formNbr}" has already been processed.`);
      }

      rows.push(validatedRow);
    } catch (err) {
      // if (err instanceof ZodError) {
      //   throw new Error(formatZodError(err, rowNumber));
      // }
       failedRows.push({
        rowNumber,
        error: err instanceof ZodError ? formatZodError(err, rowNumber) : (err as Error).message,
        values,
      });
      continue;
      // throw new Error(
      //   `Row ${rowNumber} validation failed: ${(err as Error).message}`
      // );
    }
  }


  console.log(`✅ Processed: ${rows.length} row(s)`);
  console.log(`❌ Failed: ${failedRows.length} row(s)`);

  if (rows.length === 0) {
    throw new Error("Excel file has no valid rows to process. It contains no new or valid entries.");
  }

  return rows;
}
