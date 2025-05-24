export interface InputRow {
  fileName: string;
  changeSetId: string;
  formNbr: string;
  formName: string;
  editionDt: string;
  lclPrtEle: boolean;
  optInd: boolean;
  msrInd: boolean;
  mnlAmdInd: boolean;
  pullLstInd: boolean;
  effectiveDate: string;
  expirationDate: string;
  lob: string;
  rcpType: string[];
  srtKey: Record<string, string>;
}
