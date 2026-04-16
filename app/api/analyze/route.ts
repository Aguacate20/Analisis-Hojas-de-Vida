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

function buildRichPrompt(jobDescription: string, cvText: string): string {
  return `
Eres un PhD en Psicología Organizacional y experto en selección de talento humano. 
Tu objetivo es realizar un análisis psicométrico y técnico de alto nivel.

DESCRIPCIÓN DEL CARGO:
${jobDescription}

CV DEL CANDIDATO:
${cvText}

TAREAS DE EVALUACIÓN:
1. Ajuste Persona-Puesto (0-100): Evalúa la convergencia entre el perfil y el cargo.
2. Big Five (OCEAN): Infiere los rasgos (0-100) analizando la narrativa de logros y estabilidad.
3. Estabilidad Laboral: Analiza la retención histórica.
4. Potencial de Crecimiento: Evalúa la curva de aprendizaje y ambición profesional.
5. Brechas Técnicas: Identifica qué le falta para el éxito inmediato.

INSTRUCCIÓN TÉCNICA: Responde ÚNICAMENTE con un objeto JSON. Sin Markdown. Sin introducciones.
{
  "nombre": "Nombre completo",
  "puntuacion": 85,
  "analisis_psicologico": "Análisis narrativo de 3-4 oraciones con rigor clínico/organizacional.",
  "competencias_clave": ["Comp 1", "Comp 2", "Comp 3", "Comp 4", "Comp 5"],
  "recomendacion": "Contratar",
  "rasgos_personalidad": {
    "apertura": 75, "responsabilidad": 80, "extraversion": 60, "amabilidad": 70, "neuroticismo": 35
  },
  "brechas_tecnicas": ["Brecha 1", "Brecha 2"],
  "potencial_crecimiento": "Alto",
  "estabilidad_laboral": "Alta"
}
`.trim();
}

async function analyzeFile(file: File, jobDescription: string): Promise<CandidatoResult> {
  const bytes = await file.arrayBuffer();
  const text = await extractTextFromFile(Buffer.from(bytes), file.type);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash', // El más estable para JSON largo
    safetySettings,
  });

  // Llamamos a nuestra función de prompt enriquecido
  const richPrompt = buildRichPrompt(jobDescription, text);

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: richPrompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2000,
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
