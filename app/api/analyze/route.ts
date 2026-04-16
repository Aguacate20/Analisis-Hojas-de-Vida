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
  // Con responseMimeType: "application/json", la respuesta YA es JSON puro
  // Solo limpiamos por si acaso hay markdown residual
  const cleanRaw = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Intentar parse directo primero
  try {
    return JSON.parse(cleanRaw) as CandidatoResult;
  } catch (e1) {
    // Buscar el primer objeto JSON completo y balanceado
    const start = cleanRaw.indexOf('{');
    if (start === -1) {
      console.error("Sin JSON en respuesta:", cleanRaw.substring(0, 200));
      throw new Error("La IA no generó un reporte estructurado.");
    }

    // Buscar el cierre balanceado del JSON
    let depth = 0;
    let end = -1;
    for (let i = start; i < cleanRaw.length; i++) {
      if (cleanRaw[i] === '{') depth++;
      else if (cleanRaw[i] === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }

    if (end === -1) {
      // JSON truncado — aumentar maxOutputTokens
      console.error("JSON truncado (sin cierre). Raw:", cleanRaw.substring(0, 300));
      throw new Error("La respuesta fue truncada. Intenta con un CV más corto.");
    }

    try {
      return JSON.parse(cleanRaw.substring(start, end + 1)) as CandidatoResult;
    } catch (e2) {
      console.error("JSON malformado:", cleanRaw.substring(start, end + 1).substring(0, 300));
      throw new Error("El formato del análisis no es procesable.");
    }
  }
}

function buildRichPrompt(jobDescription: string, cvText: string): string {
  return `
Eres un PhD en Psicología Organizacional y experto en selección de talento humano. 
Tu objetivo es realizar un análisis psicométrico y técnico de alto nivel EXTREMADAMENTE conciso.

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
      temperature: 0.1,
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
