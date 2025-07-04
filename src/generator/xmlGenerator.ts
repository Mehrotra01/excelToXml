// src/generator/xmlGenerator.ts
import { create } from "xmlbuilder2";
import * as fs from "fs-extra";
import * as path from "path";
import { markFileAsProcessed } from "../logger/processedFileLogs";

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[\\/:*?"<>|\s]+/g, "_") // Remove unsafe characters
    .replace(/[^a-zA-Z0-9_.-]/g, "");
}

export async function generateXMLFile(rows: any[]): Promise<string[]> {
  const outDir =  path.resolve("./output");
  await fs.ensureDir(outDir);
  const allFiles: string[] = [];

  for (const row of rows) {
    const metadata = row.meta;
    const sanitizedFileName = sanitizeFileName(metadata.fileName);
    const fileName = `${sanitizedFileName}-${row.formNbr || "unknown"}.xml`;
    const filePath = path.join(outDir, fileName);

    const root = create({ version: "1.0", encoding: "UTF-8" })
      .ele("databaseChangeLog", {
        xmlns: "http://www.liquibase.org/xml/ns/dbchangelog",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xmlns:ext": "http://www.liquibase.org/xml/ns/dbchangelog-ext",
        "xmlns:mongodb": "http://www.liquibase.org/xml/ns/mongodb",
        "xmlns:mongodb-pro": "http://www.liquibase.org/xml/ns/pro-mongodb",
        "xsi:schemaLocation":
          "http://www.liquibase.org/xml/ns/dbchangelog http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-latest.xsd " +
          "http://www.liquibase.org/xml/ns/dbchangelog-ext http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-ext.xsd " +
          "http://www.liquibase.org/xml/ns/pro-mongodb http://www.liquibase.org/xml/ns/pro-mongodb/liquibase-pro-mongodb-latest.xsd " +
          "http://www.liquibase.org/xml/ns/mongodb http://www.liquibase.org/xml/ns/mongodb/liquibase-mongodb-latest.xsd"
      });

    const changeSet = root.ele("changeSet", {
      id: `${metadata.changeSetId}_${row.formNbr}`,
      author: "$(collection.name)"
    });

    if (metadata.operation === "insert") {
      const fullDocument = {
        formName: row.formName,
        formNbr: row.formNbr,
        editionDt: row.editionDt,
        localPrintEligibleInd: row.localPrintElidgble,
        optionalInd: row.optionalInd,
        manualAmendmentInd: row.manualAmendInd,
        manuscriptInd: row.manuscriptInd,
        pullListInd: row.pullListInd,
        mailingAdderssInd: row.mailingAdderssInd,
        xyzInd: row.xyzInd,
        effectiveDate: row.effectiveDate,
        expirationDate: row.expirationDate,
        lob: row.lob,
        recipientTypes: row.rcpType,
        sortingKeys: row.srtKey,
        ...Object.fromEntries(
          Object.entries(row).filter(
            ([key]) =>
              ![
                "meta",
                "formName",
                "formNbr",
                "editionDt",
                "localPrintElidgble",
                "optionalInd",
                "manualAmendInd",
                "manuscriptInd",
                "pullListInd",
                "mailingAdderssInd",
                "xyzInd",
                "effectiveDate",
                "expirationDate",
                "lob",
                "rcpType",
                "srtKey"
              ].includes(key)
          )
        )
      };

      const insert = changeSet.ele("mongodb:insertOne", {
        collectionName: "$(collection.name)"
      });
      insert.ele("mongodb:document").txt(JSON.stringify(fullDocument, null, 2));
    } else if (metadata.operation === "update") {
      const update = changeSet.ele("mongodb:updateOne", {
        collectionName: "$(collection.name)"
      });
      update.ele("mongodb:filter").txt(
        JSON.stringify(
          {
            formnbr: row.formNbr
          },
          null,
          2
        )
      );
      update.ele("mongodb:update").txt(
        JSON.stringify(
          {
            $set: row.attributeToUpdate
          },
          null,
          2
        )
      );
    }

    const xml = root.end({ prettyPrint: true });
    await fs.writeFile(filePath, xml, "utf-8");
    await markFileAsProcessed(`${sanitizedFileName}-${row.formNbr || ""}`);
    allFiles.push(filePath);
  }

  return allFiles;
}