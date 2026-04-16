import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '500', '600', '700', '800'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm',
  weight: ['300', '400', '500'],
});

export const metadata: Metadata = {
  title: 'Senda — Reclutamiento Semántico con IA',
  description:
    'Analiza hojas de vida con Inteligencia Artificial. Ranking automático, perfil psicológico y recomendaciones de contratación.',
  keywords: ['reclutamiento', 'IA', 'hojas de vida', 'selección de personal', 'ATS'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${syne.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
