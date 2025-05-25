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
    // const filePath = req.file?.path;
    if (!fileReq.file || !fileReq.file.path)
      return res.status(400).json({ error: "No file uploaded" });

    const { data,errors } = await processExcelFile(fileReq.file.path);
    return res.status(errors.length ? 207 : 200).json({
      message: errors.length
        ? `${data.length} row(s) passed, ${errors.length} failed.`
        : "All rows processed successfully.",
      errors,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(port, () => {
  console.log(`server running on http://localhost:${port}`);
});
