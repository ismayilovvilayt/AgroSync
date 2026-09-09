import type { Metadata, Viewport } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';

export const viewport: Viewport = {
  themeColor: '#10B981',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'AgroSync — Aqrotexniki İdarəetmə Sistemi',
  description: 'Şirkətlər və aqronomlar üçün aqrotexniki işlərin, proseslərin, suvarmaların və anbar hərəkətlərinin idarə edilməsi platforması.',
  keywords: 'aqronomiya, ERP, kənd təsərrüfatı, suvarma, anbar, təsərrüfat idarəetmə',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="az">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
