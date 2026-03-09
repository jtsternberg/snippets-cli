import clipboardy from "clipboardy";

export async function readClipboard(): Promise<string> {
  return clipboardy.read();
}

export async function writeClipboard(text: string): Promise<void> {
  await clipboardy.write(text);
}
