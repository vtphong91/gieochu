declare module "pdf-parse" {
  export interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    text: string;
    version: string;
  }
  function pdfParse(buffer: Buffer, options?: { max?: number }): Promise<PdfParseResult>;
  export default pdfParse;
}
