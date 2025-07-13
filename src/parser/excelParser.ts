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

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

const InsertSchema = z.object({
  changeSetId: z.string().min(1),
  formNbr: z.string().min(1),
  formName: z.string().min(1),
  effectiveDate: z.string().min(1),
  expirationDate: z.string().min(1),
  rcpType: z.array(z.string()).optional(),
  srtKey: z.string().min(8).max(20),
});

export async function parseExcel(filePath: string): Promise<{
  data: ParsedRow[];
  errors: { Sheet: number; rowNumber: number; error: string }[];
  skipped: { Sheet: number; rowNumber: number; reason: string }[];
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const rows: ParsedRow[] = [];
  const failedRows: { Sheet: number; rowNumber: number; error: string }[] = [];
  const skippedRows: { Sheet: number; rowNumber: number; reason: string }[] =
    [];

  for (const [sheetIndex, worksheet] of workbook.worksheets.entries()) {
    const sheetNumber = sheetIndex + 1;
    const operation: "insert" | "update" =
      sheetNumber === 1 ? "insert" : "update";

    const headerRow = worksheet.getRow(1);
    const headers: string[] = Array.isArray(headerRow.values)
      ? headerRow.values.slice(1).map((v) => v?.toString().trim() || "")
      : [];

    const requiredHeaders =
      operation === "insert" ? REQUIRED_FIELDS : ["formNbr", "changeSetId"];

    const missingHeaders = requiredHeaders.filter(
      (field) => !headers.includes(field)
    );
    if (missingHeaders.length > 0) {
      failedRows.push({
        Sheet: sheetNumber,
        rowNumber: 1,
        error: `Missing column(s): ${missingHeaders.join(", ")}`,
      });
      continue;
    }

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const rowValues = Array.isArray(row.values) ? row.values.slice(1) : [];

      if (
        rowValues.every(
          (val) => val === null || val === undefined || val === ""
        )
      )
        continue;

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

      const requiredBase = ["changeSetId", "formNbr"];
      const missingBase = requiredBase.filter(
        (key) => !(key in data) || data[key] === ""
      );
      if (missingBase.length > 0) {
        failedRows.push({
          Sheet: sheetNumber,
          rowNumber,
          error: `Missing required fields: ${missingBase.join(", ")}`,
        });
        continue;
      }

      const generatedFileName = `${getTodayDate()}-${data.changeSetId}`;
      const fileKey = generatedFileName;
      const alreadyProcessed = await hasFileBeenProcessed(fileKey);
      if (alreadyProcessed) {
        skippedRows.push({
          Sheet: sheetNumber,
          rowNumber,
          reason: `File "${fileKey}" has already been processed.`,
        });
        continue;
      }

      const meta = {
        operation,
        fileName: generatedFileName,
        changeSetId: data.changeSetId,
      };

      try {
        if (operation === "insert") {
          InsertSchema.parse(data);

          const raw = String(data.srtKey || "").trim();
          const digits = raw.replace(/\D/g, "");
          if (digits.length !== 8) {
            failedRows.push({
              Sheet: sheetNumber,
              rowNumber,
              error: `Invalid srtKey format: must be exactly 8 digits`,
            });
            continue;
          }
          data.srtKey = {
            LEVEL1: digits.substring(0, 2),
            LEVEL2: digits.substring(2, 5),
            LEVEL3: digits.substring(5, 8),
          };

          const emptyFields: string[] = [];
          [...REQUIRED_FIELDS].forEach((key) => {
            if (
              key === "rcpType" &&
              Array.isArray(data[key]) &&
              data[key].length === 0
            ) {
              emptyFields.push(key);
            } else if (key === "srtKey" && !data[key]) {
              emptyFields.push(key);
            } else if (data[key] === "") {
              emptyFields.push(key);
            }
          });

          Object.entries(data).forEach(([key, val]) => {
            if (
              ![...REQUIRED_FIELDS, "changeSetId", ...OPTIONAL_FIELDS].includes(
                key
              ) &&
              val === ""
            ) {
              emptyFields.push(key);
            }
          });

          if (emptyFields.length > 0) {
            failedRows.push({
              Sheet: sheetNumber,
              rowNumber,
              error: `Empty values for: ${emptyFields.join(", ")}`,
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
                  "changeSetId",
                  ...OPTIONAL_FIELDS,
                ].includes(key)
            )
          );

          rows.push({ meta, ...staticFields, ...dynamicFields });
        } else if (operation === "update") {
          const attributeToUpdate: Record<string, any> = {};

          for (const [key, value] of Object.entries(data)) {
            if (
              !["formNbr", "changeSetId"].includes(key) &&
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
                    Sheet: sheetNumber,
                    rowNumber,
                    error: `Invalid srtKey format: must be exactly 8 digits`,
                  });
                  break;
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
              Sheet: sheetNumber,
              rowNumber,
              error: `No attributes provided for update.`,
            });
            continue;
          }

          rows.push({ meta, formNbr: data.formNbr, attributeToUpdate });
        }
      } catch (err: any) {
        failedRows.push({
          Sheet: sheetNumber,
          rowNumber,
          error:
            err instanceof ZodError
              ? formatZodError(err, rowNumber)
              : err.message,
        });
      }
    }
  }

  console.log(`✅ Parsed: ${rows.length} rows`);
  console.log(`❌ Failed: ${failedRows.length}`);
  console.log(`⏭️ Skipped: ${skippedRows.length}`);

  return { data: rows, errors: failedRows, skipped: skippedRows };
}
