import { readTextWithAutoEncoding } from "./fileIO";
import { IngestionEngine } from "./IngestionEngine";
import type { ParsedCsv } from "./types";

export type ImportResult =
  | {
      fileName: string;
      status: "success";
      parsed: ParsedCsv;
    }
  | {
      fileName: string;
      status: "error";
      error: string;
    };

export const importUploadedFiles = async (
  files: File[],
  engine: IngestionEngine = new IngestionEngine()
): Promise<ImportResult[]> => {
  return Promise.all(
    files.map(async (file) => {
      const fileName = file.name;
      const loweredName = fileName.toLowerCase();

      if (loweredName.endsWith(".pdf")) {
        return {
          fileName,
          status: "error",
          error: "não habilitado",
        };
      }

      if (!loweredName.endsWith(".csv")) {
        return {
          fileName,
          status: "error",
          error: "tipo de arquivo não suportado",
        };
      }

      const text = await readTextWithAutoEncoding(file);
      const parsed = engine.parseCsvByHeader(text);

      return {
        fileName,
        status: "success",
        parsed,
      };
    })
  );
};
