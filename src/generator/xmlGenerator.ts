import { create } from 'xmlbuilder2';
import fs from 'fs-extra';
import { InputRow } from '../types/inputRow';
import path from 'path';

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[:\/\\\?\*"<>\|]/g, '')   // remove invalid characters
    .replace(/\s+/g, '_')               // replace spaces with underscores
    .replace(/[^a-zA-Z0-9_\-\.]/g, ''); // remove other unsafe characters
}

export async function generateXMLFile(rows: InputRow[]) {
  console.log("Started creating XML", rows);

  const outDir = './output';
  await fs.ensureDir(outDir);

  for (const row of rows) {
    const root = create({ version: '1.0', encoding:"UTF-8" })
      .ele('databaseChangeLog', { xmlns: 'http://www.liquibase.org/xml/ns/dbchangelog' })
      .ele('changeSet', {
        id: row.changeSetId,
        author: 'system',
      })
      .ele('insert', { tableName: 'your_table_name' });

    root.ele('column', { name: 'formNbr', value: row.formNbr }).up()
        .ele('column', { name: 'formName', value: row.formName }).up()
        .ele('column', { name: 'lob', value: row.lob });

    root.up().up().up();

    const xml = root.end({ prettyPrint: true });

    const sanitizedFileName = sanitizeFileName(row.fileName);
    const filePath = path.join(outDir, `${sanitizedFileName}.xml`);
    await fs.writeFile(filePath, xml, 'utf-8');
    console.log(`✅ XML generated at: ${filePath}`);
  }
}
