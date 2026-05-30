'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const PUBLIC_PATHS = ['/login'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<'loading' | 'auth' | 'noauth'>('loading');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (PUBLIC_PATHS.includes(pathname)) {
      setStatus('auth');
      return;
    }

    const pw = localStorage.getItem('app-password') || 'leadscraper2024';
    const token = localStorage.getItem('auth-token');
    if (token === pw) {
      setStatus('auth');
    } else {
      setStatus('noauth');
      router.replace('/login');
    }
  }, [pathname, router]);

  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: '#1C1C1E' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="ios-spinner ios-spinner-lg" />
          <p className="text-[13px] font-medium" style={{ color: '#8E8E93' }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'noauth') return null;

  return <>{children}</>;
}
