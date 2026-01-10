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
          error: "nao habilitado",
        };
      }

      if (!loweredName.endsWith(".csv")) {
        return {
          fileName,
          status: "error",
          error: "tipo de arquivo nao suportado",
        };
      }

      try {
        const text = await readTextWithAutoEncoding(file);
        const parsed = engine.parseCsvByHeader(text);
        return {
          fileName,
          status: "success",
          parsed,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Falha ao ler o CSV";
        return {
          fileName,
          status: "error",
          error: message,
        };
      }
    })
  );
};
