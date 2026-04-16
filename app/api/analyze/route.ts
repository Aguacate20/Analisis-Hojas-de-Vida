import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractTextFromFile } from "@/lib/extractors";

const genAI = new GoogleGenerativeAI(process.env.GEMMA_API_KEY!);

export async function POST(req: Request) {
  const formData = await req.formData();
  const files = formData.getAll('resumes') as File[];
  const jobDescription = formData.get('jobDescription') as string;

  const results = await Promise.all(files.map(async (file) => {
    const bytes = await file.arrayBuffer();
    const text = await extractTextFromFile(Buffer.from(bytes), file.type);

    // Configuración de Gemma 4 con razonamiento profundo
    const model = genAI.getGenerativeModel({ 
      model: "gemma-4-31b-it",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      Actúa como un PhD en Psicología Organizacional. Analiza el siguiente CV frente a la descripción del cargo.
      
      Cargo: ${jobDescription}
      CV del Candidato: ${text}

      Extrae y evalúa:
      1. Ajuste Persona-Puesto (0-100).
      2. Rasgos de personalidad inferidos (Big Five).
      3. Estabilidad laboral y potencial de crecimiento.
      4. Brechas técnicas (Gaps).
      
      Responde SOLO en formato JSON con esta estructura:
      {
        "nombre": "string",
        "puntuacion": number,
        "analisis_psicologico": "string",
        "competencias_clave": ["string"],
        "recomendacion": "Contratar/Entrevistar/Descartar"
      }
    `;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  }));

  return Response.json(results);
}
