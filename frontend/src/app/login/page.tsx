'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('auth-token');
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/auth-check?password=${encodeURIComponent(storedToken)}`);
        const data = await res.json();
        if (data.valid) {
          router.push('/');
          return;
        }
      } catch {
        // Offline — allow cached token
        const defaultPw = 'leadscraper2024';
        if (storedToken === defaultPw) {
          router.push('/');
          return;
        }
      }
      localStorage.removeItem('auth-token');
      setLoading(false);
    };
    checkAuth();
  }, [router, API_BASE]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth-check?password=${encodeURIComponent(password)}`);
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem('auth-token', password);
        router.push('/');
      } else {
        setError('Invalid password');
        setPassword('');
      }
    } catch {
      // Offline fallback — use default password
      if (password === 'leadscraper2024') {
        localStorage.setItem('auth-token', password);
        router.push('/');
      } else {
        setError('Invalid password');
        setPassword('');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F2F2F7' }}>
        <div className="ios-spinner ios-spinner-lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F2F2F7' }}>
      <div className="w-full max-w-sm ios-page-enter">
        <div className="ios-card p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-[60px] h-[60px] rounded-[16px] flex items-center justify-center mb-4"
              style={{ backgroundColor: '#007AFF' }}
            >
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="ios-title-large text-center">LeadScraper Pro</h1>
            <p className="text-[13px] mt-1" style={{ color: '#8E8E93' }}>Sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: '#3A3A3C' }}>Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Enter your password"
                  className="ios-input pr-10"
                  style={{
                    borderColor: focused ? '#007AFF' : 'transparent',
                    boxShadow: focused ? '0 0 0 3px rgba(0,122,255,0.15)' : 'none',
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60"
                  style={{ color: '#8E8E93' }}
                >
                  {showPw ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
              {error && (
                <p className="text-[12px] font-medium mt-1.5" style={{ color: '#FF3B30' }}>{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="ios-btn w-full text-[15px] py-3"
            >
              Sign In
            </button>
          </form>
        </div>
        <p className="text-center text-[11px] mt-4" style={{ color: '#8E8E93' }}>Protected access</p>
      </div>
    </div>
  );
}
