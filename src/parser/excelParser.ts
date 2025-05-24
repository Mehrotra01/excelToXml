import ExcelJS from "exceljs";

export interface InputRow {
  fileName: string;
  changeSetId: string;
  formNbr: string;
  formName: string;
  editionDt: string;
  lclPrtEle: boolean;
  optInd: boolean;
  msrInd: boolean;
  mnlAmdInd: boolean;
  pullLstInd: boolean;
  effectiveDate: string;
  expirationDate: string;
  lob: string;
  rcpType: string[]; // JSON-parsed string
  srtKey: Record<string, string>; // JSON-parsed string
}

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

    const values = row.values.slice(1); // safely skip first empty index (Excel is 1-indexed)

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

    rows.push({
      fileName: String(fileName),
      changeSetId: String(changeSetId),
      formNbr: String(formNbr),
      formName: String(formName),
      editionDt: String(editionDt),
      lclPrtEle: lclPrtEle === "true",
      optInd: optInd === "true",
      msrInd: msrInd === "true",
      mnlAmdInd: mnlAmdInd === "true",
      pullLstInd: pullLstInd === "true",
      effectiveDate: String(effectiveDate),
      expirationDate: String(expirationDate),
      lob: String(lob),
      rcpType: String(rcpType || "")
        .split(",")
        .map((str) => str.trim())
        .filter(Boolean),
      srtKey: parseLooseJson(srtKey),

    });
  });
  return rows;
}

function parseLooseJson(input: any): Record<string, string> {
  if (!input) return {};

  const str = String(input).trim();
  const obj: Record<string, string> = {};

  str.split(',').forEach(pair => {
    const [key, value] = pair.split(':').map(p => p.trim());
    if (key && value) {
      obj[key] = value;
    }
  });

  return obj;
}
