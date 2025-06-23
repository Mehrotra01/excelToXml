// src/generator/xmlGenerator.ts
import { create } from "xmlbuilder2";
import fs from "fs-extra";
import path from "path";
import { markFileAsProcessed } from "../logger/processedFileLogs";

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[:\/\\?\*"<>|]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-\.]/g, "");
}

export async function generateXMLFile(rows: any[]): Promise<string[]> {
  const outDir = "./output";
  await fs.ensureDir(outDir);
  const allFiles: string[] = [];

  for (const row of rows) {
    const root = create({ version: "1.0", encoding: "UTF-8" })
      .ele("databaseChangeLog", {
        xmlns: "http://www.liquibase.org/xml/ns/dbchangelog",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xsi:schemaLocation":
          "http://www.liquibase.org/xml/ns/dbchangelog http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-4.4.xsd"
      });

    const changeSet = root.ele("changeSet", {
      id: row.meta.changeSetId,
      author: "system"
    });

    if (row.meta.operation === "insert") {
      const insert = changeSet.ele("insert", { tableName: "your_table_name" });

      insert.ele("column", { name: "formNbr", value: row.formNbr });
      insert.ele("column", { name: "formName", value: row.formName });
      insert.ele("column", { name: "lob", value: row.lob });

      Object.entries(row).forEach(([key, value]) => {
        if (!["meta", "formNbr", "formName", "lob"].includes(key)) {
          insert.ele("column", {
            name: key,
            value: typeof value === "object" ? JSON.stringify(value) : String(value)
          });
        }
      });
    }

    if (row.meta.operation === "update") {
      const update = changeSet.ele("update", { tableName: "your_table_name" });

      Object.entries(row.attributeToUpdate || {}).forEach(([key, value]) => {
        update.ele("column", {
          name: key,
          value: typeof value === "object" ? JSON.stringify(value) : String(value)
        });
      });

      const formNbr = row.formNbr?.trim();
      if (formNbr === "*" || !formNbr) {
        update.ele("where").txt("1=1");
      } else if (formNbr.includes(",")) {
        const list = formNbr
          .split(",")
          .map((f: string) => `'${f.trim()}'`)
          .join(", ");
        update.ele("where").txt(`formNbr IN (${list})`);
      } else {
        update.ele("where").txt(`formNbr = '${formNbr}'`);
      }
    }

    const xml = root.end({ prettyPrint: true });
    const filePath = path.join(outDir, `${sanitizeFileName(row.meta.fileName)}.xml`);
    await fs.writeFile(filePath, xml, "utf-8");
    console.log(`✅ XML generated at: ${filePath}`);
    await markFileAsProcessed(`${row.meta.fileName}-${row.formNbr}`);
    allFiles.push(filePath);
  }

  return allFiles;
}