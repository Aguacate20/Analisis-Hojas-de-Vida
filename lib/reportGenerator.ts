import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { CandidatoResult } from '../../types';

const COLORS = {
  primary: [30, 41, 59] as [number, number, number],       // slate-800
  accent: [99, 102, 241] as [number, number, number],      // indigo-500
  success: [16, 185, 129] as [number, number, number],     // emerald-500
  warning: [245, 158, 11] as [number, number, number],     // amber-500
  danger: [239, 68, 68] as [number, number, number],       // red-500
  muted: [100, 116, 139] as [number, number, number],      // slate-500
  light: [241, 245, 249] as [number, number, number],      // slate-100
  white: [255, 255, 255] as [number, number, number],
};

function recomendacionColor(r: string): [number, number, number] {
  if (r === 'Contratar') return COLORS.success;
  if (r === 'Entrevistar') return COLORS.warning;
  return COLORS.danger;
}

function drawHeader(doc: jsPDF, pageWidth: number) {
  // Header background
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Accent stripe
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 35, pageWidth, 3, 'F');

  // Logo text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.white);
  doc.text('SENDA', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Reclutamiento Semántico y Psicotécnico con IA', 14, 29);

  // Date
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text(`Generado el ${dateStr}`, pageWidth - 14, 24, { align: 'right' });
}

function drawSectionTitle(doc: jsPDF, title: string, y: number, pageWidth: number): number {
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(14, y, pageWidth - 28, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.primary);
  doc.text(title.toUpperCase(), 18, y + 7);
  return y + 16;
}

function drawBigFive(
  doc: jsPDF,
  rasgos: CandidatoResult['rasgos_personalidad'],
  startX: number,
  startY: number,
  width: number
): number {
  const labels: [keyof typeof rasgos, string][] = [
    ['apertura', 'Apertura'],
    ['responsabilidad', 'Responsabilidad'],
    ['extraversion', 'Extraversión'],
    ['amabilidad', 'Amabilidad'],
    ['neuroticismo', 'Neuroticismo'],
  ];

  const rowH = 9;
  let y = startY;

  doc.setFontSize(8);
  for (const [key, label] of labels) {
    const val = Math.max(0, Math.min(100, rasgos[key] ?? 50));
    const barWidth = width - 60;

    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(label, startX, y + 5);

    // Bar background
    doc.setFillColor(226, 232, 240); // slate-200
    doc.roundedRect(startX + 52, y, barWidth, 5, 2, 2, 'F');

    // Bar fill - color by value
    const fillColor: [number, number, number] =
      val >= 70 ? COLORS.success : val >= 40 ? COLORS.accent : COLORS.warning;
    doc.setFillColor(...fillColor);
    doc.roundedRect(startX + 52, y, (barWidth * val) / 100, 5, 2, 2, 'F');

    // Value
    doc.setTextColor(...COLORS.primary);
    doc.setFont('helvetica', 'bold');
    doc.text(`${val}`, startX + 52 + barWidth + 4, y + 5);

    y += rowH;
  }
  return y + 4;
}

export function generateProfessionalPDF(data: CandidatoResult[]): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ── Página 1: Resumen ejecutivo ──────────────────────────────────────────
  drawHeader(doc, pageWidth);

  let y = 50;

  // Summary title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primary);
  doc.text('Reporte de Selección de Candidatos', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.text(`${data.length} candidato${data.length !== 1 ? 's' : ''} evaluado${data.length !== 1 ? 's' : ''}`, margin, y);
  y += 12;

  // Ranking table
  y = drawSectionTitle(doc, 'Ranking General', y, pageWidth);

  const tableData = data
    .sort((a, b) => b.puntuacion - a.puntuacion)
    .map((c, i) => [
      `#${i + 1}`,
      c.nombre,
      `${c.puntuacion}%`,
      c.recomendacion,
      c.potencial_crecimiento,
      c.estabilidad_laboral,
    ]);

  (doc as any).autoTable({
    startY: y,
    head: [['#', 'Candidato', 'Match', 'Recomendación', 'Potencial', 'Estabilidad']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 4,
    },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
    },
    didParseCell: (hookData: any) => {
      if (hookData.section === 'body' && hookData.column.index === 3) {
        const val = hookData.cell.raw as string;
        if (val === 'Contratar') hookData.cell.styles.textColor = COLORS.success;
        else if (val === 'Entrevistar') hookData.cell.styles.textColor = COLORS.warning;
        else hookData.cell.styles.textColor = COLORS.danger;
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  // ── Páginas de detalle por candidato ─────────────────────────────────────
  const sorted = [...data].sort((a, b) => b.puntuacion - a.puntuacion);

  for (const candidato of sorted) {
    doc.addPage();
    drawHeader(doc, pageWidth);
    y = 48;

    // Candidate name + score badge
    const recColor = recomendacionColor(candidato.recomendacion);
    doc.setFillColor(...recColor);
    doc.roundedRect(pageWidth - margin - 42, y - 7, 42, 12, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.white);
    doc.text(candidato.recomendacion.toUpperCase(), pageWidth - margin - 21, y, {
      align: 'center',
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.primary);
    doc.text(candidato.nombre, margin, y);

    y += 8;

    // Score line
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      `Fit Score: ${candidato.puntuacion}%   ·   Potencial: ${candidato.potencial_crecimiento}   ·   Estabilidad: ${candidato.estabilidad_laboral}`,
      margin,
      y
    );
    y += 12;

    // Two-column layout
    const colW = (pageWidth - margin * 2 - 8) / 2;

    // LEFT: Análisis psicológico
    y = drawSectionTitle(doc, 'Análisis Psicológico', y, pageWidth);
    const startAnalysisY = y;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85); // slate-700
    const lines = doc.splitTextToSize(candidato.analisis_psicologico, colW);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 8;

    // RIGHT: Big Five (positioned next to analysis)
    let rightY = startAnalysisY;
    const rightX = margin + colW + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.primary);

    // Section label for right column
    doc.setFillColor(...COLORS.light);
    doc.roundedRect(rightX, startAnalysisY - 10, colW, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.primary);
    doc.text('PERSONALIDAD (BIG FIVE)', rightX + 4, startAnalysisY - 3);
    rightY = startAnalysisY + 4;

    if (candidato.rasgos_personalidad) {
      rightY = drawBigFive(doc, candidato.rasgos_personalidad, rightX, rightY, colW);
    }

    y = Math.max(y, rightY) + 4;

    // Competencias
    y = drawSectionTitle(doc, 'Competencias Clave', y, pageWidth);
    const compPerRow = 3;
    const compW = (pageWidth - margin * 2 - (compPerRow - 1) * 4) / compPerRow;

    for (let i = 0; i < candidato.competencias_clave.length; i++) {
      const col = i % compPerRow;
      const row = Math.floor(i / compPerRow);
      const cx = margin + col * (compW + 4);
      const cy = y + row * 11;

      doc.setFillColor(224, 231, 255); // indigo-100
      doc.roundedRect(cx, cy, compW, 8, 2, 2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(67, 56, 202); // indigo-700
      const compText = doc.splitTextToSize(candidato.competencias_clave[i], compW - 6);
      doc.text(compText[0], cx + compW / 2, cy + 5, { align: 'center' });
    }
    y += Math.ceil(candidato.competencias_clave.length / compPerRow) * 11 + 8;

    // Brechas técnicas
    if (candidato.brechas_tecnicas && candidato.brechas_tecnicas.length > 0) {
      y = drawSectionTitle(doc, 'Brechas Técnicas (Gaps)', y, pageWidth);

      for (const brecha of candidato.brechas_tecnicas) {
        doc.setFillColor(254, 242, 242); // red-50
        doc.roundedRect(margin, y, pageWidth - margin * 2, 8, 2, 2, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(185, 28, 28); // red-700
        doc.text(`⚠  ${brecha}`, margin + 4, y + 5.5);
        y += 11;
      }
      y += 4;
    }

    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text('Senda — Reclutamiento Semántico y Psicotécnico con IA', margin, pageHeight - 8);
    doc.text(
      `${sorted.indexOf(candidato) + 1} / ${sorted.length}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  doc.save(`Senda_Reporte_${new Date().toISOString().slice(0, 10)}.pdf`);
}
