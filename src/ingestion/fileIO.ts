const REPLACEMENT_CHAR = "\uFFFD";

const hasReplacementChar = (text: string): boolean => text.includes(REPLACEMENT_CHAR);

export const readTextWithAutoEncoding = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const utf8Text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);

  if (!hasReplacementChar(utf8Text)) {
    return utf8Text;
  }

  return new TextDecoder("iso-8859-1").decode(buffer);
};
