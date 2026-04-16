'use client';

import { useState, useCallback, useRef } from 'react';
import {
  FileText,
  Upload,
  Loader2,
  Download,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  FileCheck,
  Users,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { generateProfessionalPDF } from './lib/reportGenerator';
import type { CandidatoResult, AnalysisProgress } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getRecomendacionClass(r: string) {
  if (r === 'Contratar') return 'badge badge-contratar';
  if (r === 'Entrevistar') return 'badge badge-entrevistar';
  return 'badge badge-descartar';
}

function getPotencialClass(p: string) {
  if (p === 'Alto') return 'badge badge-alto';
  if (p === 'Medio') return 'badge badge-medio';
  return 'badge badge-bajo';
}

function bigFiveColor(val: number): string {
  if (val >= 70) return '#10b981';
  if (val >= 40) return '#6366f1';
  return '#f59e0b';
}

function scoreColor(score: number): string {
  if (score >= 75) return '#10b981';
  if (score >= 50) return '#6366f1';
  return '#f59e0b';
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function BigFiveBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="big-five-row">
      <span className="big-five-label">{label}</span>
      <div className="big-five-track">
        <div
          className="big-five-fill"
          style={{ width: `${v}%`, background: bigFiveColor(v) }}
        />
      </div>
      <span className="big-five-val">{v}</span>
    </div>
  );
}

function CandidateCard({
  candidato,
  rank,
}: {
  candidato: CandidatoResult;
  rank: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    candidato.rasgos_personalidad ||
    (candidato.brechas_tecnicas && candidato.brechas_tecnicas.length > 0);

  return (
    <div className="candidate-card">
      {/* Rank */}
      <div className="candidate-rank">#{rank} · Candidato</div>

      {/* Top row */}
      <div className="candidate-top">
        <div>
          <h3 className="candidate-name">{candidato.nombre}</h3>
          <div className="candidate-meta">
            <span className={getRecomendacionClass(candidato.recomendacion)}>
              {candidato.recomendacion === 'Contratar' && '✓ '}
              {candidato.recomendacion === 'Descartar' && '✕ '}
              {candidato.recomendacion === 'Entrevistar' && '◎ '}
              {candidato.recomendacion}
            </span>
            {candidato.potencial_crecimiento && (
              <span className={getPotencialClass(candidato.potencial_crecimiento)}>
                <TrendingUp size={10} />
                &nbsp;{candidato.potencial_crecimiento}
              </span>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            className="score-pill"
            style={{ color: scoreColor(candidato.puntuacion) }}
          >
            {candidato.puntuacion}%
          </div>
          <div className="score-label-sm">fit score</div>
        </div>
      </div>

      {/* Analysis */}
      <p className="candidate-analysis">{candidato.analisis_psicologico}</p>

      {/* Competencias */}
      {candidato.competencias_clave && candidato.competencias_clave.length > 0 && (
        <div className="competencias-list">
          {candidato.competencias_clave.map((c, i) => (
            <span key={i} className="competencia-tag">
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Expandable detail */}
      {hasDetails && (
        <>
          <button
            className="detail-toggle"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                <ChevronUp size={14} /> Ocultar detalles
              </>
            ) : (
              <>
                <ChevronDown size={14} /> Ver perfil completo
              </>
            )}
          </button>

          {expanded && (
            <div className="detail-section">
              {/* Big Five */}
              {candidato.rasgos_personalidad && (
                <div>
                  <p className="detail-section-title">Personalidad (Big Five)</p>
                  <div className="big-five">
                    <BigFiveBar label="Apertura" value={candidato.rasgos_personalidad.apertura} />
                    <BigFiveBar
                      label="Responsabilidad"
                      value={candidato.rasgos_personalidad.responsabilidad}
                    />
                    <BigFiveBar
                      label="Extraversión"
                      value={candidato.rasgos_personalidad.extraversion}
                    />
                    <BigFiveBar label="Amabilidad" value={candidato.rasgos_personalidad.amabilidad} />
                    <BigFiveBar
                      label="Neuroticismo"
                      value={candidato.rasgos_personalidad.neuroticismo}
                    />
                  </div>
                </div>
              )}

              {/* Brechas */}
              {candidato.brechas_tecnicas && candidato.brechas_tecnicas.length > 0 && (
                <div>
                  <p className="detail-section-title">Brechas Técnicas</p>
                  <div className="brechas-list">
                    {candidato.brechas_tecnicas.map((b, i) => (
                      <div key={i} className="brecha-item">
                        <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                        {b}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────

function StatsBar({ results }: { results: CandidatoResult[] }) {
  const contratar = results.filter((r) => r.recomendacion === 'Contratar').length;
  const entrevistar = results.filter((r) => r.recomendacion === 'Entrevistar').length;
  const descartar = results.filter((r) => r.recomendacion === 'Descartar').length;
  const avgScore = Math.round(results.reduce((a, b) => a + b.puntuacion, 0) / results.length);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '10px',
        marginBottom: '1.5rem',
      }}
    >
      {[
        { icon: <Users size={15} />, label: 'Total', value: results.length, color: '#6366f1' },
        { icon: <FileCheck size={15} />, label: 'Contratar', value: contratar, color: '#10b981' },
        { icon: <Sparkles size={15} />, label: 'Entrevistar', value: entrevistar, color: '#f59e0b' },
        { icon: <X size={15} />, label: 'Descartar', value: descartar, color: '#f43f5e' },
        { icon: <TrendingUp size={15} />, label: 'Fit promedio', value: `${avgScore}%`, color: '#6366f1' },
      ].map((s) => (
        <div
          key={s.label}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.875rem 1rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              color: s.color,
              marginBottom: 4,
            }}
          >
            {s.icon}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.375rem',
              fontWeight: 800,
              color: 'var(--ink-950)',
              letterSpacing: '-0.03em',
            }}
          >
            {s.value}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--ink-400)', marginTop: 1 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function SendaHome() {
  const [jobDescription, setJobDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress>({
    current: 0,
    total: 0,
    currentName: '',
    status: 'idle',
  });
  const [results, setResults] = useState<CandidatoResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: File[]) => {
    const supported = newFiles.filter((f) =>
      ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'].includes(f.type)
    );
    const rejected = newFiles.length - supported.length;
    if (rejected > 0) {
      setError(`${rejected} archivo(s) ignorado(s). Solo se aceptan PDF y Word (.docx).`);
      setTimeout(() => setError(null), 4000);
    }
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const unique = supported.filter((f) => !existing.has(f.name + f.size));
      return [...prev, ...unique];
    });
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startAnalysis = async () => {
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      setError('La descripción del cargo es demasiado corta. Por favor, detállala más.');
      return;
    }
    if (files.length === 0) {
      setError('Sube al menos una hoja de vida.');
      return;
    }

    setError(null);
    setResults(null);
    setProgress({ current: 0, total: files.length, currentName: files[0].name, status: 'processing' });

    const formData = new FormData();
    files.forEach((file) => formData.append('resumes', file));
    formData.append('jobDescription', jobDescription);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Error del servidor (${response.status})`);
      }

      setResults(data);
      setProgress((p) => ({ ...p, current: files.length, status: 'done' }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido. Intenta de nuevo.';
      setError(msg);
      setProgress((p) => ({ ...p, status: 'error' }));
    }
  };

  const isLoading = progress.status === 'processing';
  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="page-wrapper">
      {/* Header */}
      <header className="site-header">
        <div className="logo-mark">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <span className="logo-text">Senda</span>
        </div>
        <p className="site-tagline">Reclutamiento Semántico y Psicotécnico con IA</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Job description */}
        <div className="card">
          <label className="card-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Descripción del Cargo
          </label>
          <textarea
            className="job-textarea"
            placeholder="Describe el cargo: responsabilidades, habilidades técnicas requeridas, competencias blandas, cultura de equipo, etc. Cuanto más detallado, mejor el análisis."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-400)', marginTop: '0.5rem', textAlign: 'right' }}>
            {jobDescription.length} caracteres
          </div>
        </div>

        {/* File upload */}
        <div className="card">
          <label className="card-label">
            <FileText size={14} />
            Hojas de Vida (PDF o Word)
          </label>

          <div
            className={`drop-zone${dragOver ? ' drag-over' : ''}`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
            <div className="drop-icon">
              <Upload />
            </div>
            <p className="drop-title">
              {dragOver ? 'Suelta los archivos aquí' : 'Haz clic o arrastra tus archivos'}
            </p>
            <p className="drop-sub">PDF o Word · Máximo 20 archivos</p>
          </div>

          {files.length > 0 && (
            <div className="file-list">
              {files.map((file, i) => (
                <div key={i} className="file-item">
                  <FileText size={14} className="file-item-icon" />
                  <span className="file-item-name">{file.name}</span>
                  <span className="file-item-size">{formatBytes(file.size)}</span>
                  <button
                    className="file-remove"
                    onClick={() => removeFile(i)}
                    title="Eliminar"
                    disabled={isLoading}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="error-box">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Progress */}
        {isLoading && (
          <div className="progress-wrapper">
            <div className="progress-info">
              <div>
                <p className="progress-label">Analizando candidatos…</p>
                <p className="progress-sub">
                  Esto puede tomar unos segundos por cada CV
                </p>
              </div>
              <Loader2 size={18} className="spin" style={{ color: 'var(--accent)' }} />
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${Math.max(progressPct, 8)}%` }}
              />
            </div>
          </div>
        )}

        {/* Analyze button */}
        <button
          className="btn-primary"
          onClick={startAnalysis}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 size={17} className="spin" />
              Procesando {files.length} CV{files.length !== 1 ? 's' : ''}…
            </>
          ) : (
            <>
              <Sparkles size={17} />
              Analizar {files.length > 0 ? `${files.length} candidato${files.length !== 1 ? 's' : ''}` : 'Candidatos'}
            </>
          )}
        </button>

        {/* Results */}
        {results && results.length > 0 && (
          <section style={{ marginTop: '1.5rem' }}>
            <div className="results-header">
              <h2 className="results-title">Ranking de Selección</h2>
              <button
                className="btn-pdf"
                onClick={() => generateProfessionalPDF(results)}
              >
                <Download size={14} />
                Descargar Reporte PDF
              </button>
            </div>

            <StatsBar results={results} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {results.map((c, i) => (
                <CandidateCard key={i} candidato={c} rank={i + 1} />
              ))}
            </div>

            <p
              style={{
                textAlign: 'center',
                fontSize: '0.75rem',
                color: 'var(--ink-400)',
                marginTop: '2rem',
              }}
            >
              Análisis generado con IA · Los resultados son orientativos y deben complementarse con entrevistas.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
