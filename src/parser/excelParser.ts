// src/parser/parseExcel.ts
import ExcelJS from "exceljs";
import { ZodError, z } from "zod";
import { hasFileBeenProcessed } from "../logger/processedFileLogs";
import { formatDate, formatZodError } from "../utils/formating";

const REQUIRED_FIELDS = [
  "formNbr",
  "formName",
  "effectiveDate",
  "expirationDate",
  "rcpType",
  "srtKey",
];
const OPTIONAL_FIELDS = ["editionDt", "lob"];

export interface ParsedRow {
  meta: {
    operation: "insert" | "update";
    fileName: string;
    changeSetId: string;
  };
  formNbr: string;
  attributeToUpdate?: Record<string, any>;
  [key: string]: any;
}

const InsertSchema = z.object({
  fileName: z.string().min(1, "Missing fileName"),
  changeSetId: z.string().min(1, "Missing changeSetId"),
  formNbr: z.string().min(1, "Missing formNbr"),
  formName: z.string().min(1, "Missing formName"),
  effectiveDate: z.string().min(1, "Missing effectiveDate"),
  expirationDate: z.string().min(1, "Missing expirationDate"),
  rcpType: z.array(z.string()).optional(),
  srtKey: z.string().min(8).max(20),
});

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
    const isEmpty = rowValues.every(
      (val: any) => val === null || val === undefined || val === ""
    );
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
      } else {
        data[header] =
          typeof cellValue === "boolean"
            ? String(cellValue)
            : String(cellValue || "").trim();
      }
    });

    try {
      const operation = (data.Operation || data.operation || "").toLowerCase();
      if (!["insert", "update"].includes(operation)) {
        failedRows.push({
          rowNumber,
          error: `Invalid or missing operation. Must be 'insert' or 'update'.`,
        });
        continue;
      }

      const requiredBase = ["fileName", "changeSetId", "formNbr"];
      const missingBase = requiredBase.filter(
        (key) => !(key in data) || data[key] === ""
      );
      if (missingBase.length > 0) {
        failedRows.push({
          rowNumber,
          error: `Missing required fields: ${missingBase.join(", ")}`,
        });
        continue;
      }

      const fileKey = `${data.fileName}-${data.formNbr}`;
      const alreadyProcessed = await hasFileBeenProcessed(fileKey);
      if (alreadyProcessed) {
        skippedRows.push({
          rowNumber,
          reason: `File \"${fileKey}\" has already been processed.`,
        });
        continue;
      }

      const meta = {
        operation: operation as "insert" | "update",
        fileName: data.fileName,
        changeSetId: data.changeSetId,
      };

      if (operation === "insert") {
        try {
          InsertSchema.parse(data);
        } catch (zodErr: any) {
          failedRows.push({
            rowNumber,
            error: formatZodError(zodErr, rowNumber),
          });
          continue;
        }

        const raw = String(data.srtKey || "").trim();
        const digits = raw.replace(/\D/g, "");
        if (digits.length !== 8) {
          failedRows.push({
            rowNumber,
            error: `Invalid srtKey format: must be exactly 8 digits (e.g., 20500200)`,
          });
          continue;
        }
        data.srtKey = {
          LEVEL1: digits.substring(0, 2),
          LEVEL2: digits.substring(2, 5),
          LEVEL3: digits.substring(5, 8),
        };

        const emptyFields: string[] = [];
        [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].forEach((key) => {
          if (
            key === "rcpType" &&
            Array.isArray(data[key]) &&
            data[key].length === 0
          ) {
            emptyFields.push(key);
          } else if (
            key === "srtKey" &&
            (!data[key] || String(data[key]).trim() === "")
          ) {
            emptyFields.push(key);
          } else if (data[key] === "") {
            emptyFields.push(key);
          }
        });
        Object.entries(data).forEach(([key, val]) => {
          if (
            ![
              ...REQUIRED_FIELDS,
              ...OPTIONAL_FIELDS,
              "fileName",
              "changeSetId",
              "Operation",
              "operation",
            ].includes(key) &&
            val === ""
          ) {
            emptyFields.push(key);
          }
        });

        if (emptyFields.length > 0) {
          failedRows.push({
            rowNumber,
            error: `Insert row contains empty values for: ${emptyFields.join(
              ", "
            )}`,
          });
          continue;
        }

        const staticFields = {
          ...REQUIRED_FIELDS.reduce((acc, key) => {
            acc[key] = data[key];
            return acc;
          }, {} as any),
          ...OPTIONAL_FIELDS.reduce((acc, key) => {
            if (data[key]) acc[key] = data[key];
            return acc;
          }, {} as any),
        };

        const dynamicFields = Object.fromEntries(
          Object.entries(data).filter(
            ([key]) =>
              ![
                ...REQUIRED_FIELDS,
                "fileName",
                "changeSetId",
                "Operation",
                "operation",
                ...OPTIONAL_FIELDS,
              ].includes(key)
          )
        );

        rows.push({
          meta,
          ...staticFields,
          ...dynamicFields,
        });
      } else if (operation === "update") {
        const attributeToUpdate: Record<string, any> = {};
        for (const [key, value] of Object.entries(data)) {
          if (
            ![...requiredBase, "Operation", "operation"].includes(key) &&
            value !== null &&
            value !== undefined &&
            String(value).trim() !== "" &&
            !(key === "rcpType" && Array.isArray(value) && value.length === 0)
          ) {
            if (key === "srtKey") {
              const raw = String(value).trim();
              const digits = raw.replace(/\D/g, "");
              if (digits.length !== 8) {
                failedRows.push({
                  rowNumber,
                  error: `Invalid srtKey format: must be exactly 8 digits (e.g., 20500200)`,
                });
                continue;
              }
              attributeToUpdate[key] = {
                LEVEL1: digits.substring(0, 2),
                LEVEL2: digits.substring(2, 5),
                LEVEL3: digits.substring(5, 8),
              };
            } else {
              attributeToUpdate[key] = value;
            }
          }
        }

        if (Object.keys(attributeToUpdate).length === 0) {
          failedRows.push({
            rowNumber,
            error: `No attributes provided for update operation.`,
          });
          continue;
        }

        rows.push({
          meta,
          formNbr: data.formNbr,
          attributeToUpdate,
        });
      }
    } catch (err: any) {
      failedRows.push({
        rowNumber,
        error:
          err instanceof ZodError
            ? formatZodError(err, rowNumber)
            : err.message,
      });
    }
  }

  console.log(`✅ Processed: ${rows.length}`);
  console.log(`❌ Failed: ${failedRows.length}`);
  console.log(`⏭️ Skipped: ${skippedRows.length}`);

  return {
    data: rows,
    errors: failedRows,
    skipped: skippedRows,
  };
}
