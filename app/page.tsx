'use client';

import { useState } from 'react';
import { FileText, Upload, Loader2, Download } from 'lucide-react';
import { generateProfessionalPDF } from '@/lib/reportGenerator';

export default function SendaHome() {
  const [jobDescription, setJobDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const startAnalysis = async () => {
    if (!jobDescription || files.length === 0) {
      alert("Por favor rellena la descripción y sube al menos un CV");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    files.forEach(file => formData.append('resumes', file));
    formData.append('jobDescription', jobDescription);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Error analizando:", error);
      alert("Error en el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-8">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-indigo-700">Senda</h1>
        <p className="text-slate-500">Reclutamiento Semántico y Psicotécnico con IA</p>
      </header>

      <div className="grid gap-6">
        {/* Descripción del Cargo */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <label className="block text-sm font-semibold mb-2">Descripción del Cargo</label>
          <textarea 
            className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Ej: Buscamos un analista de datos con capacidad de liderazgo y resiliencia..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </section>

        {/* Carga de Archivos */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <label className="block text-sm font-semibold mb-2">Hojas de Vida (PDF o Word)</label>
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
            <input 
              type="file" 
              multiple 
              onChange={handleFileChange} 
              className="hidden" 
              id="cv-upload" 
            />
            <label htmlFor="cv-upload" className="cursor-pointer flex flex-col items-center">
              <Upload className="w-10 h-10 text-slate-400 mb-2" />
              <span className="text-sm text-slate-600">Haz clic para subir o arrastra los archivos</span>
              <span className="text-xs text-slate-400 mt-1">{files.length} archivos seleccionados</span>
            </label>
          </div>
        </section>

        <button 
          onClick={startAnalysis}
          disabled={loading}
          className="bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 flex justify-center items-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" /> : "Analizar Candidatos"}
        </button>

        {/* Resultados */}
        {results && (
          <section className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Ranking de Selección</h2>
              <button 
                onClick={() => generateProfessionalPDF(results)}
                className="flex gap-2 items-center text-sm bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                <Download size={16} /> Descargar Reporte PDF
              </button>
            </div>
            
            <div className="grid gap-4">
              {results.map((c, i) => (
                <div key={i} className="bg-white p-5 rounded-lg border-l-4 border-indigo-500 shadow-sm">
                  <div className="flex justify-between">
                    <h3 className="font-bold text-lg">{c.nombre}</h3>
                    <span className="text-indigo-600 font-bold">{c.puntuacion}% Fit</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">{c.analisis_psicologico}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
