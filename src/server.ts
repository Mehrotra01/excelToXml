// src/server.ts or wherever your main entry is
import express from "express";
import multer from "multer";
import path from "path";
import { processExcelFile } from "./mainProcessor";
import fs from "fs-extra";
import { MulterReqquest } from "./types/express-multer";

const app = express();
const port = 3300;

const uploadDir = path.join(__dirname, "../uploads");
fs.ensureDirSync(uploadDir);

// configure multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

app.post("/upload", upload.single("excel"), async (req, res): Promise<any> => {
  const fileReq = req as MulterReqquest;
  try {
    if (!fileReq.file || !fileReq.file.path)
      return res.status(400).json({ error: "No file uploaded" });

    const { data, errors, skipped } = await processExcelFile(fileReq.file.path);

    const statusCode = errors.length || skipped.length ? 207 : 200;
    const message =
      statusCode === 207
        ? `${data.length} row(s) passed, ${errors.length} failed, ${skipped.length} skipped.`
        : "All rows processed successfully.";

    return res.status(statusCode).json({
      message,
      passed: data.length,
      failed: errors.length,
      skipped: skipped.length,
      errors,
      skippedRows: skipped,
      data
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
