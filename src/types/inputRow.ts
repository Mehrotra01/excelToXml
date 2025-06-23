import { z } from "zod";

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

export const InsertSchema = z.object({
  fileName: z.string().min(1, "Missing fileName"),
  changeSetId: z.string().min(1, "Missing changeSetId"),
  formNbr: z.string().min(1, "Missing formNbr"),
  formName: z.string().min(1, "Missing formName"),
  effectiveDate: z.string().min(1, "Missing effectiveDate"),
  expirationDate: z.string().min(1, "Missing expirationDate"),
  rcpType: z.array(z.string()).optional(),
  srtKey: z.string().min(8).max(20),
});