import ExcelJS from "exceljs";
import { formatZodError, inputRowSchema } from "../validation/schema";
import { InputRow } from "../types/inputRow";
import { ZodError } from "zod";

export async function parseExcel(filePath: string): Promise<InputRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet(1);

  const rows: InputRow[] = [];
  if (!worksheet) {
    throw new Error("Worksheet 'Sheet1' not found in the Excel file.");
  }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    if (!Array.isArray(row.values)) {
      console.warn(`Row ${rowNumber} is not an array, skipping.`);
      return;
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
      rows.push(validatedRow);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new Error(formatZodError(err, rowNumber));
      }
      throw new Error(
        `Row ${rowNumber} validation failed: ${(err as Error).message}`
      );
    }
  });

  if (rows.length === 0) {
    throw new Error("Excel file has no valid rows to process.");
  }

  return rows;
}

function formatDate(excelDate: any): string {
  if (!excelDate) return "";
  const date = new Date(excelDate);
  if (isNaN(date.getTime())) return String(excelDate); // fallback for non-date values
  return (
    (date.getMonth() + 1).toString().padStart(2, "0") +
    "/" +
    date.getDate().toString().padStart(2, "0") +
    "/" +
    date.getFullYear()
  );
}

function parseLooseJson(input: any): Record<string, string> {
  if (!input) return {};

  const str = String(input).trim();
  const obj: Record<string, string> = {};

  str.split(",").forEach((pair) => {
    const [key, value] = pair.split(/[:;]/).map((p) => p.trim());
    if (key && value) {
      obj[key.toLowerCase()] = String(value); // <-- ensure value is a string
    }
  });

  return obj;
}
