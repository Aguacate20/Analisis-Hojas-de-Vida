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

    if (!hfResponse.ok) {
      const err = await hfResponse.json();
      return Response.json({ error: err.detail || 'Error en el análisis.' }, { status: hfResponse.status });
    }

    const data = await hfResponse.json();
    return Response.json(data.results);

  } catch (error) {
    console.error('[API /analyze] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error interno.' },
      { status: 500 }
    );
  }
}
