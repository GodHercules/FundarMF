const EXTENSION_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png"
};

export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
export const DOCUMENT_TYPES_LABEL = "PDF, JPG ou PNG";

function getExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot === -1 ? "" : fileName.slice(lastDot).toLowerCase();
}

function matchesSignature(extension: string, bytes: Uint8Array) {
  if (extension === ".pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (extension === ".png") return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  return extension === ".jpg" || extension === ".jpeg" ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff : false;
}

export async function validateDocumentFiles(files: File[]) {
  for (const file of files) {
    const extension = getExtension(file.name);
    const expectedMime = EXTENSION_MIME[extension];
    const actualMime = file.type.trim().toLowerCase();

    if (!expectedMime) return `Arquivo "${file.name}" não permitido. Envie apenas PDF, JPG ou PNG.`;
    if (actualMime && actualMime !== expectedMime) return `O tipo de "${file.name}" não corresponde à extensão informada.`;

    const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    if (!matchesSignature(extension, bytes)) return `O conteúdo de "${file.name}" não corresponde ao tipo informado.`;
  }

  return null;
}
