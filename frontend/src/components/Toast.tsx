'use client';

import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastCtx {
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastCtx>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).slice(2, 8);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container — fixed bottom center */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-[12px] shadow-lg ios-page-enter"
            style={{
              backgroundColor: t.type === 'error' ? '#FF3B30' : t.type === 'info' ? '#007AFF' : '#34C759',
              minWidth: 200,
              maxWidth: '90vw',
            }}
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-white shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4 text-white shrink-0" />}
            {t.type === 'info' && <AlertCircle className="w-4 h-4 text-white shrink-0" />}
            <span className="text-[13px] font-medium text-white flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-white/70 hover:text-white ios-btn-press shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
