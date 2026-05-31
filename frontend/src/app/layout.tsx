import type { Metadata } from 'next';
import './globals.css';
import AuthGuard from '@/components/AuthGuard';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'LeadScraper Pro — Find & Enrich Business Leads',
  description: 'Modern lead scraping tool with waterfall enrichment. Find local businesses and their contact information in real-time.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen ios-scroll relative" style={{ backgroundColor: '#F2F2F7' }}>
        {/* Faded scorpion watermark — centered on all pages */}
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none select-none" style={{ zIndex: 0 }}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-[500px] h-[500px] sm:w-[600px] sm:h-[600px]"
            style={{ opacity: 0.035, color: '#FF6B35' }}
          >
            <path d="M12 2C10.5 4 9 6 9 8.5C9 10.4 10.3 12 12 12C13.7 12 15 10.4 15 8.5C15 6 13.5 4 12 2Z" fill="currentColor"/>
            <path d="M12 12C12 12 8 13 6 16C4 19 12 22 12 22C12 22 20 19 18 16C16 13 12 12 12 12Z" fill="currentColor" opacity="0.7"/>
            <path d="M7 8L3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 9L2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M17 8L21 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19 9L22 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 14L11 18L12 20L13 18L12 14Z" fill="currentColor"/>
          </svg>
        </div>
        <div className="relative" style={{ zIndex: 1 }}>
          <ToastProvider>
            <AuthGuard>{children}</AuthGuard>
          </ToastProvider>
        </div>
      </body>
    </html>
  );
}
