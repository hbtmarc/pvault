import { IngestionEngine } from "./engine/IngestionEngine";
import type { FileParseOutcome } from "./core/types";

export const importUploadedFiles = async (
  files: File[],
  options?: { importSessionId?: string; engine?: IngestionEngine }
): Promise<FileParseOutcome[]> => {
  const engine = options?.engine ?? new IngestionEngine();
  const csvFiles = files.filter((file) => file.name.toLowerCase().endsWith(".csv"));
  const nonCsvFiles = files.filter(
    (file) => !file.name.toLowerCase().endsWith(".csv")
  );

  const outcomes = await engine.parseFiles(csvFiles, {
    importSessionId: options?.importSessionId,
  });

  nonCsvFiles.forEach((file) => {
    const lowered = file.name.toLowerCase();
    const message = lowered.endsWith(".pdf")
      ? "nao habilitado"
      : "tipo de arquivo nao suportado";
    outcomes.push({
      fileName: file.name,
      status: "error",
      message,
    });
  });

  return outcomes;
};
