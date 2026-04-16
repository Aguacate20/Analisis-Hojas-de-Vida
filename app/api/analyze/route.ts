import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { extractTextFromFile, isSupportedType } from '../../../lib/extractors';
import type { CandidatoResult } from '../../../types';

if (!process.env.GEMMA_API_KEY) {
  throw new Error('La variable de entorno GEMMA_API_KEY no está configurada.');
}

const genAI = new GoogleGenerativeAI(process.env.GEMMA_API_KEY);

// Ajuste para Vercel Hobby (10s limit): Procesamos de 1 en 1
const BATCH_SIZE = 1;

// Configuración de seguridad para evitar que la IA bloquee CVs por error
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

function extractJSON(raw: string): CandidatoResult {
  try {
    // 1. Limpieza agresiva de Markdown y espacios
    const cleanRaw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanRaw) as CandidatoResult;
  } catch (e) {
    // 2. Intento de búsqueda por expresiones regulares si lo anterior falla
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as CandidatoResult;
      } catch (innerError) {
        console.error("Respuesta fallida de la IA:", raw);
        throw new Error("El formato del análisis no es procesable.");
      }
    }
    console.error("Respuesta sin JSON:", raw);
    throw new Error("La IA no generó un reporte estructurado.");
  }
}

async function analyzeFile(file: File, jobDescription: string): Promise<CandidatoResult> {
  const bytes = await file.arrayBuffer();
  // CORRECCIÓN BUFFER: Usamos Buffer.from para evitar el error de los logs
  const text = await extractTextFromFile(Buffer.from(bytes), file.type);

  // Usamos un modelo altamente estable para JSON
  const model = genAI.getGenerativeModel({
    model: 'gemma-4-31b-it', // Cámbialo a 'gemma-4-31b-it' si ya confirmaste el ID exacto
    safetySettings,
  });

  const prompt = `Actúa como PhD en Psicología Organizacional. Analiza el CV para el cargo: ${jobDescription}. 
  CV: ${text}
  Responde estrictamente en JSON con los campos: nombre, puntuacion (0-100), analisis_psicologico, competencias_clave (array), recomendacion, rasgos_personalidad (objeto con apertura, responsabilidad, extraversion, amabilidad, neuroticismo), brechas_tecnicas (array), potencial_crecimiento, estabilidad_laboral.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1, // Mínima creatividad para mayor estabilidad
      responseMimeType: "application/json",
    }
  });

  const raw = result.response.text();
  return extractJSON(raw);
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
