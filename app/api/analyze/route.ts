import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractTextFromFile, isSupportedType } from '../../../lib/extractors';
import type { CandidatoResult } from '../../../../types';

if (!process.env.GEMMA_API_KEY) {
  throw new Error('La variable de entorno GEMMA_API_KEY no está configurada.');
}

const genAI = new GoogleGenerativeAI(process.env.GEMMA_API_KEY);

const BATCH_SIZE = 3;

function buildPrompt(jobDescription: string, cvText: string): string {
  return `
Eres un PhD en Psicología Organizacional y experto en selección de talento humano.
Analiza el siguiente CV en relación con la descripción del cargo.

DESCRIPCIÓN DEL CARGO:
${jobDescription}

CV DEL CANDIDATO:
${cvText}

Realiza un análisis profundo y evalúa:
1. Ajuste Persona-Puesto (0-100): qué tan bien encaja el perfil con el cargo.
2. Rasgos de personalidad Big Five inferidos del lenguaje y experiencia (valores 0-100 cada uno).
3. Estabilidad laboral basada en duración promedio en cada empresa.
4. Potencial de crecimiento basado en trayectoria y logros.
5. Brechas técnicas específicas frente al cargo.

INSTRUCCIÓN CRÍTICA: Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes ni después, sin bloques de código markdown. El JSON debe seguir exactamente esta estructura:
{
  "nombre": "Nombre completo del candidato (extráelo del CV)",
  "puntuacion": 85,
  "analisis_psicologico": "Análisis narrativo de 3-4 oraciones sobre el perfil psicológico, motivaciones y fit cultural.",
  "competencias_clave": ["Competencia 1", "Competencia 2", "Competencia 3", "Competencia 4", "Competencia 5"],
  "recomendacion": "Contratar",
  "rasgos_personalidad": {
    "apertura": 75,
    "responsabilidad": 80,
    "extraversion": 60,
    "amabilidad": 70,
    "neuroticismo": 35
  },
  "brechas_tecnicas": ["Brecha 1", "Brecha 2"],
  "potencial_crecimiento": "Alto",
  "estabilidad_laboral": "Alta"
}

Valores permitidos:
- recomendacion: "Contratar" | "Entrevistar" | "Descartar"
- potencial_crecimiento: "Alto" | "Medio" | "Bajo"
- estabilidad_laboral: "Alta" | "Media" | "Baja"
`.trim();
}

function extractJSON(raw: string): CandidatoResult {
  // Intentar parsear directamente
  try {
    return JSON.parse(raw) as CandidatoResult;
  } catch {
    // Si falla, buscar el primer objeto JSON válido en el texto
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('La IA no devolvió un JSON válido en su respuesta.');
    }
    try {
      return JSON.parse(match[0]) as CandidatoResult;
    } catch {
      throw new Error('No se pudo parsear el JSON extraído de la respuesta.');
    }
  }
}

async function analyzeFile(
  file: File,
  jobDescription: string
): Promise<CandidatoResult> {
  // Validar tipo de archivo
  if (!isSupportedType(file.type)) {
    throw new Error(
      `Tipo de archivo no soportado: "${file.name}". Solo se aceptan PDF y Word (.docx).`
    );
  }

  // Extraer texto
  const bytes = await file.arrayBuffer();
  const text = await extractTextFromFile(Buffer.from(bytes), file.type);

  // Configurar modelo (gemini-1.5-flash: rápido, económico, soporta JSON)
  const model = genAI.getGenerativeModel({
    model: 'gemma-4-31b-it',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  });

  const result = await model.generateContent(buildPrompt(jobDescription, text));
  const raw = result.response.text();
  const parsed = extractJSON(raw);

  // Garantizar que el nombre tenga un fallback si Gemini no lo encontró
  if (!parsed.nombre || parsed.nombre.trim() === '') {
    parsed.nombre = file.name.replace(/\.[^/.]+$/, '');
  }

  return parsed;
}

async function processBatches(
  files: File[],
  jobDescription: string
): Promise<CandidatoResult[]> {
  const results: CandidatoResult[] = [];

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((file) => analyzeFile(file, jobDescription))
    );
    results.push(...batchResults);
  }

  return results;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('resumes') as File[];
    const jobDescription = formData.get('jobDescription') as string;

    // Validaciones básicas
    if (!jobDescription || jobDescription.trim().length < 20) {
      return Response.json(
        { error: 'La descripción del cargo es demasiado corta. Por favor, detállala más.' },
        { status: 400 }
      );
    }

    if (!files || files.length === 0) {
      return Response.json(
        { error: 'No se recibieron archivos.' },
        { status: 400 }
      );
    }

    if (files.length > 20) {
      return Response.json(
        { error: 'Máximo 20 CVs por análisis.' },
        { status: 400 }
      );
    }

    const results = await processBatches(files, jobDescription);

    // Ordenar por puntuación descendente
    results.sort((a, b) => b.puntuacion - a.puntuacion);

    return Response.json(results);
  } catch (error) {
    console.error('[API /analyze] Error:', error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Error interno del servidor. Por favor intenta de nuevo.',
      },
      { status: 500 }
    );
  }
}
