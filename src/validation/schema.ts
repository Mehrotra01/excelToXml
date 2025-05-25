import { z, ZodError } from "zod";

export const inputRowSchema = z.object({
  fileName: z.string().min(1, "fileName is required"),
  changeSetId: z.string().min(1, "changeSetId is required"),
  formNbr: z.string().min(1, "formNbr is required"),
  formName: z.string().min(1, "formName is required"),
  editionDt: z.string().min(5, "editionDt is missing"),
  lclPrtEle: z.boolean(),
  optInd: z.boolean(),
  msrInd: z.boolean(),
  mnlAmdInd: z.boolean(),
  pullLstInd: z.boolean(),
  effectiveDate: z
    .string()
    .regex(
      /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/,
      "effectiveDate must be in MM/DD/YYYY format"
    ),
  expirationDate: z
    .string()
    .regex(
      /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/,
      "expirationDate must be in MM/DD/YYYY format"
    ),
  lob: z.string().min(1, "lob is required"),
  rcpType: z
    .array(z.string())
    .nonempty("rcpType must be a non-empty array of strings"),
  srtKey: z.object({
    level1: z.string().min(2),
    level2: z.string().min(3),
    level3: z.string().min(3)
  }),
});

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
