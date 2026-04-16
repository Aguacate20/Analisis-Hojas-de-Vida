export const maxDuration = 60;

const HF_API_URL = process.env.HF_SPACE_URL;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    
    const files = formData.getAll('resumes') as File[];
    const jobDescription = formData.get('jobDescription') as string;

    if (!jobDescription || jobDescription.trim().length < 20) {
      return Response.json(
        { error: 'La descripción del cargo es demasiado corta.' },
        { status: 400 }
      );
    }

    if (!files || files.length === 0) {
      return Response.json({ error: 'No se recibieron archivos.' }, { status: 400 });
    }

    const hfResponse = await fetch(`${HF_API_URL}/analyze`, {
      method: 'POST',
      body: formData,
    });

    // Leer como texto primero para detectar errores de HF
    const responseText = await hfResponse.text();

    // Si HF retorna HTML (cold start o error), lo detectamos
    if (responseText.startsWith('<') || responseText.includes('Your space')) {
      return Response.json(
        { error: 'El servidor de análisis está iniciando. Espera 30 segundos e intenta de nuevo.' },
        { status: 503 }
      );
    }

    if (!hfResponse.ok) {
      const err = JSON.parse(responseText);
      return Response.json({ error: err.detail || 'Error en el análisis.' }, { status: hfResponse.status });
    }

    const data = JSON.parse(responseText);
    return Response.json(data.results);

  } catch (error) {
    console.error('[API /analyze] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error interno.' },
      { status: 500 }
    );
  }
}
