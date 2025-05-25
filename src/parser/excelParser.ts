import { InputRow } from "inputRow";
import { hasFileBeenProcessed } from "../logger/processedFileLogs";
import { parseLooseJson } from "../utils/formating";
import { formatDate } from "../utils/formating";
import { formatZodError } from "../utils/formating";
import { inputRowSchema } from "../validation/schema";
import { ZodError } from "zod";
import ExcelJS from "exceljs";

export async function parseExcel(filePath: string): Promise<{
  data: InputRow[];
  errors: { rowNumber: number; error: string }[];
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet(1);

  const data: InputRow[] = [];
  const errors: { rowNumber: number; error: string }[] = [];

  if (!worksheet) {
    throw new Error("Worksheet not found.");
  }

  let actualRowCount = 0;

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);

    if (!Array.isArray(row.values)) {
      console.warn(`Row ${rowNumber} is not an array, skipping.`);
      continue;
    }
    const values = row.values.slice(1);

    const isEmpty = values.every(
      (val: any) => val === null || val === undefined || val === ""
    );
    if (isEmpty) continue;

    actualRowCount++;

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
        effectiveDate: formatDate(effectiveDate),
        expirationDate: formatDate(expirationDate),
        lob,
        rcpType: String(rcpType || "")
          .split(",")
          .map((str) => str.trim())
          .filter(Boolean),
        srtKey: parseLooseJson(srtKey),
      };

      const validatedRow = inputRowSchema.parse(formattedRow);

      const alreadyProcessed = await hasFileBeenProcessed(
        String(fileName + "-" + formNbr || "")
      );
      if (alreadyProcessed) {
        throw new Error(
          `⚠️ File "${fileName + "-" + formNbr}" has already been processed.`
        );
      }

      data.push(validatedRow);
    } catch (err) {
      errors.push({
        rowNumber,
        error:
          err instanceof ZodError
            ? formatZodError(err, rowNumber)
            : (err as Error).message,
      });
    }
  }

  return {
    data,
    errors,
  };
}
