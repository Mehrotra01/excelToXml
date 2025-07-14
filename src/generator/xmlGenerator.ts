import { create } from "xmlbuilder2";
import * as fs from "fs-extra";
import * as path from "path";
import { ParsedRow } from "../parser/excelParser";
import { markFileAsProcessed } from "../logger/processedFileLogs";

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[\\/:*?"<>|\s]+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "");
}

export async function generateXMLFiles(
  groupedInserts: Record<string, ParsedRow[]>,
  updates: ParsedRow[],
  groupedUpdates: Record<string, ParsedRow[]>
): Promise<string[]> {
  const outDir = path.resolve("./output");
  await fs.ensureDir(outDir);
  const allFiles: string[] = [];

  const insertedKeys = new Set<string>();

  // Handle INSERTS
  for (const [fileName, rows] of Object.entries(groupedInserts)) {
    const sanitizedFileName = sanitizeFileName(fileName);
    const filePath = path.join(outDir, `${sanitizedFileName}.xml`);
    const { changeSetId } = rows[0].meta;

    const root = create({ version: "1.0", encoding: "UTF-8" }).ele("databaseChangeLog", {
      xmlns: "http://www.liquibase.org/xml/ns/dbchangelog",
      "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "xmlns:ext": "http://www.liquibase.org/xml/ns/dbchangelog-ext",
      "xmlns:mongodb": "http://www.liquibase.org/xml/ns/mongodb",
      "xmlns:mongodb-pro": "http://www.liquibase.org/xml/ns/pro-mongodb",
      "xsi:schemaLocation":
        "http://www.liquibase.org/xml/ns/dbchangelog http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-latest.xsd " +
        "http://www.liquibase.org/xml/ns/dbchangelog-ext http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-ext.xsd " +
        "http://www.liquibase.org/xml/ns/pro-mongodb http://www.liquibase.org/xml/ns/pro-mongodb/liquibase-pro-mongodb-latest.xsd " +
        "http://www.liquibase.org/xml/ns/mongodb http://www.liquibase.org/xml/ns/mongodb/liquibase-mongodb-latest.xsd",
    });

    const changeSet = root.ele("changeSet", {
      id: `${changeSetId}_insert`,
      author: "$(collection.name)",
    });

    if (rows.length > 1) {
      const insertMany = changeSet.ele("mongodb:insertMany", {
        collectionName: "$(collection.name)",
      });

      const docs = rows.map((row) => {
        const { meta, attributeToUpdate, ...doc } = row;
        insertedKeys.add(`${row.meta.changeSetId}__${row.formNbr}`);
        return doc;
      });

      insertMany.ele("mongodb:documents").txt(JSON.stringify(docs, null, 2));
    } else {
      const { meta, attributeToUpdate, ...doc } = rows[0];
      insertedKeys.add(`${meta.changeSetId}__${doc.formNbr}`);

      const insert = changeSet.ele("mongodb:insertOne", {
        collectionName: "$(collection.name)",
      });

      insert.ele("mongodb:document").txt(JSON.stringify(doc, null, 2));
    }

    const xml = root.end({ prettyPrint: true });
    await fs.writeFile(filePath, xml, "utf-8");
    await markFileAsProcessed(sanitizedFileName);
    allFiles.push(filePath);
  }

  // Handle UPDATES
  const validUpdates = updates.filter((row) => {
    const key = `${row.meta.changeSetId}__${row.formNbr}`;
    if (insertedKeys.has(key)) return false; // skip rows already inserted
    if (!row.attributeToUpdate || Object.keys(row.attributeToUpdate).length === 0) return false;
    return true;
  });

  // Merge updates into groupedUpdates
  for (const row of validUpdates) {
    const key = row.meta.fileName;
    if (!groupedUpdates[key]) groupedUpdates[key] = [];
    const exists = groupedUpdates[key].some(
      (r) => r.formNbr === row.formNbr && r.meta.changeSetId === row.meta.changeSetId
    );
    if (!exists) groupedUpdates[key].push(row);
  }

  for (const [fileName, rows] of Object.entries(groupedUpdates)) {
    if (rows.length === 0) continue;

    const sanitizedFileName = sanitizeFileName(fileName);
    const filePath = path.join(outDir, `${sanitizedFileName}_updates.xml`);
    const { changeSetId } = rows[0].meta;

    const root = create({ version: "1.0", encoding: "UTF-8" }).ele("databaseChangeLog", {
      xmlns: "http://www.liquibase.org/xml/ns/dbchangelog",
      "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "xmlns:ext": "http://www.liquibase.org/xml/ns/dbchangelog-ext",
      "xmlns:mongodb": "http://www.liquibase.org/xml/ns/mongodb",
      "xmlns:mongodb-pro": "http://www.liquibase.org/xml/ns/pro-mongodb",
      "xsi:schemaLocation":
        "http://www.liquibase.org/xml/ns/dbchangelog http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-latest.xsd " +
        "http://www.liquibase.org/xml/ns/dbchangelog-ext http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-ext.xsd " +
        "http://www.liquibase.org/xml/ns/pro-mongodb http://www.liquibase.org/xml/ns/pro-mongodb/liquibase-pro-mongodb-latest.xsd " +
        "http://www.liquibase.org/xml/ns/mongodb http://www.liquibase.org/xml/ns/mongodb/liquibase-mongodb-latest.xsd",
    });

    const changeSet = root.ele("changeSet", {
      id: `${changeSetId}_update`,
      author: "$(collection.name)",
    });

    if (rows.length > 1) {
      const updateMany = changeSet.ele("mongodb:updateMany", {
        collectionName: "$(collection.name)",
      });

      const filters = rows.map((row) => ({ formNbr: row.formNbr }));
      const updates = rows.map((row) => ({ $set: row.attributeToUpdate }));

      updateMany.ele("mongodb:filters").txt(JSON.stringify(filters, null, 2));
      updateMany.ele("mongodb:updates").txt(JSON.stringify(updates, null, 2));
    } else {
      const row = rows[0];

      const updateOne = changeSet.ele("mongodb:updateOne", {
        collectionName: "$(collection.name)",
      });

      updateOne
        .ele("mongodb:filter")
        .txt(JSON.stringify({ formNbr: row.formNbr }, null, 2));
      updateOne
        .ele("mongodb:update")
        .txt(JSON.stringify({ $set: row.attributeToUpdate }, null, 2));
    }

    const xml = root.end({ prettyPrint: true });
    await fs.writeFile(filePath, xml, "utf-8");
    await markFileAsProcessed(`${sanitizedFileName}_updates`);
    allFiles.push(filePath);
  }

  return allFiles;
}
