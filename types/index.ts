export interface CandidatoResult {
  nombre: string;
  puntuacion: number;
  analisis_psicologico: string;
  competencias_clave: string[];
  recomendacion: 'Contratar' | 'Entrevistar' | 'Descartar';
  rasgos_personalidad: {
    apertura: number;
    responsabilidad: number;
    extraversion: number;
    amabilidad: number;
    neuroticismo: number;
  };
  brechas_tecnicas: string[];
  potencial_crecimiento: 'Alto' | 'Medio' | 'Bajo';
  estabilidad_laboral: 'Alta' | 'Media' | 'Baja';
}

export interface AnalysisProgress {
  current: number;
  total: number;
  currentName: string;
  status: 'idle' | 'processing' | 'done' | 'error';
}
