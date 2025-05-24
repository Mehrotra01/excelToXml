import { Request } from "express";
import { File } from "multer";
export interface MulterReqquest extends Request{
    file:File
}