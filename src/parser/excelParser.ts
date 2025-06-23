// src/parser/parseExcel.ts
import ExcelJS from "exceljs";
import { ZodError } from "zod";
import { hasFileBeenProcessed } from "../logger/processedFileLogs";
import { formatDate, formatZodError } from "../utils/formating";

const REQUIRED_FIELDS = ["formNbr", "formName", "effectiveDate", "expirationDate", "rcpType", "srtKey"];
const OPTIONAL_FIELDS = ["editionDt", "lob"];

export interface ParsedRow {
  meta: {
    operation: "insert" | "update";
    fileName: string;
    changeSetId: string;
  };
  formNbr: string;
  formName: string;
  effectiveDate: string;
  expirationDate: string;
  rcpType: string[];
  srtKey: Record<string, string>;
  editionDt?: string;
  lob?: string;
  [key: string]: any;
}

export async function parseExcel(filePath: string): Promise<{
  data: ParsedRow[];
  errors: { rowNumber: number; error: string }[];
  skipped: { rowNumber: number; reason: string }[];
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) throw new Error("Worksheet not found in the Excel file.");

  const headerRow = worksheet.getRow(1);
  const headers: string[] = Array.isArray(headerRow.values)
    ? headerRow.values.slice(1).map((v) => v?.toString().trim() || "")
    : [];

  const rows: ParsedRow[] = [];
  const failedRows: { rowNumber: number; error: string }[] = [];
  const skippedRows: { rowNumber: number; reason: string }[] = [];
  const seenAttributesGlobal = new Set<string>();

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const rowValues = Array.isArray(row.values) ? row.values.slice(1) : [];
    const isEmpty = rowValues.every((val: any) => val === null || val === undefined || val === "");
    if (isEmpty) continue;

    const data: any = {};
    headers.forEach((header, idx) => {
      const cellValue = rowValues[idx];
      if (["effectiveDate", "expirationDate"].includes(header)) {
        data[header] = formatDate(cellValue);
      } else if (header === "rcpType") {
        data[header] = String(cellValue || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (header === "srtKey") {
        const raw = String(cellValue || "").trim();
        const digits = raw.replace(/\D/g, "");
        if (digits.length !== 8) {
          failedRows.push({ rowNumber, error: `Invalid srtKey format: must be exactly 8 digits (e.g., 20500200)` });
          return;
        }
        const srtObj: Record<string, string> = {
          LEVEL1: digits.substring(0, 2),
          LEVEL2: digits.substring(2, 5),
          LEVEL3: digits.substring(5, 8)
        };
        data[header] = srtObj;
      } else {
        data[header] = typeof cellValue === "boolean" ? cellValue : String(cellValue || "").trim();
      }
    });

    try {
      const missing = ["fileName", "changeSetId", ...REQUIRED_FIELDS].filter((key) => !(key in data) || data[key] === "" || data[key] === undefined || data[key] === null);
      if (missing.length > 0) {
        failedRows.push({ rowNumber, error: `Missing required fields: ${missing.join(", ")}` });
        continue;
      }

      const fileKey = `${data.fileName}-${data.formNbr}`;
      const alreadyProcessed = await hasFileBeenProcessed(fileKey);
      if (alreadyProcessed) {
        skippedRows.push({ rowNumber, reason: `File \"${fileKey}\" has already been processed.` });
        continue;
      }

      const seenAttrs = new Set<string>();
      for (const key of headers) {
        if (![...REQUIRED_FIELDS, "fileName", "changeSetId", ...OPTIONAL_FIELDS].includes(key)) {
          if (seenAttrs.has(key)) {
            failedRows.push({ rowNumber, error: `❌ Duplicate attribute \"${key}\" in row` });
            continue;
          }
          if (seenAttributesGlobal.has(`${fileKey}-${key}`)) {
            failedRows.push({ rowNumber, error: `❌ Attribute \"${key}\" is duplicated across rows for form \"${fileKey}\"` });
            continue;
          }
          seenAttrs.add(key);
          seenAttributesGlobal.add(`${fileKey}-${key}`);
        }
      }

      const meta = {
        operation: "insert",
        fileName: data.fileName,
        changeSetId: data.changeSetId
      };

      const staticFields = {
        ...REQUIRED_FIELDS.reduce((acc, key) => {
          acc[key] = data[key];
          return acc;
        }, {} as any),
        ...OPTIONAL_FIELDS.reduce((acc, key) => {
          if (data[key]) acc[key] = data[key];
          return acc;
        }, {} as any)
      };

      const dynamicFields = Object.fromEntries(
        Object.entries(data).filter(
          ([key]) => ![...REQUIRED_FIELDS, "fileName", "changeSetId", ...OPTIONAL_FIELDS, "operation"].includes(key)
        )
      );

      const parsedRow: ParsedRow = {
        meta,
        ...staticFields,
        ...dynamicFields
      };

      rows.push(parsedRow);
    } catch (err: any) {
      failedRows.push({
        rowNumber,
        error: err instanceof ZodError ? formatZodError(err, rowNumber) : err.message
      });
    }
  }
  console.log(headers)
  console.log(`✅ Processed: ${rows.length}`);
  console.log(`❌ Failed: ${failedRows.length}`);
  console.log(`⏭️ Skipped: ${skippedRows.length}`);

  return {
    data: rows,
    errors: failedRows,
    skipped: skippedRows
  };
}
