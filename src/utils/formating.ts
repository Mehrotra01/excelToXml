import { ZodError } from "zod";


export function formatDate(excelDate: any): string {
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

export function parseLooseJson(input: any): Record<string, string> {
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

export function formatZodError(error: ZodError, rowIndex?: number) {
  const messages = error.errors.map((err) => {
    const path = err.path.join(".");
    const expected =
      err.code === "invalid_type"
        ? `expected ${err.expected}, got ${err.received}`
        : "";
    return `${path} is ${err.message}${expected ? ` (${expected})` : ""}`;
  });

  return `Row ${rowIndex ?? "?"} validation failed: ${messages.join("; ")}`;
}
