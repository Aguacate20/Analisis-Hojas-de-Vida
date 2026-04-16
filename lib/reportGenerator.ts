import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generateProfessionalPDF = (data: any[]) => {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text("Reporte de Selección Semántica - Senda", 20, 20);
  
  const tableData = data.map(c => [
    c.nombre, 
    `${c.puntuacion}%`, 
    c.recomendacion, 
    c.competencias_clave.join(", ")
  ]);

  (doc as any).autoTable({
    startY: 30,
    head: [['Candidato', 'Match', 'Recomendación', 'Competencias']],
    body: tableData,
  });

  doc.save("Reporte_Candidatos_Senda.pdf");
};
