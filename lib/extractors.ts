import pdf from 'pdf-parse';
import mammoth from 'mammoth';

const SUPPORTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

export function isSupportedType(mimetype: string): boolean {
  return SUPPORTED_TYPES.includes(mimetype);
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimetype: string
): Promise<string> {
  if (mimetype === 'application/pdf') {
    try {
      const data = await pdf(buffer);
      if (!data.text || data.text.trim().length < 50) {
        throw new Error('El PDF parece estar vacío o escaneado sin OCR.');
      }
      return data.text;
    } catch (err) {
      throw new Error(`No se pudo leer el PDF: ${(err as Error).message}`);
    }
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    try {
      const data = await mammoth.extractRawText({ buffer });
      if (!data.value || data.value.trim().length < 50) {
        throw new Error('El archivo Word parece estar vacío.');
      }
      return data.value;
    } catch (err) {
      throw new Error(`No se pudo leer el archivo Word: ${(err as Error).message}`);
    }
  }

  throw new Error(`Tipo de archivo no soportado: ${mimetype}`);
}
