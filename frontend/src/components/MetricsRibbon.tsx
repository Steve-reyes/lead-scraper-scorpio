'use client';

import { Users, Loader2 } from 'lucide-react';
import type { Metrics } from '@/lib/types';

interface MetricsRibbonProps {
  metrics: Metrics;
  isSearching: boolean;
  status?: string;
}

export default function MetricsRibbon({ metrics, isSearching, status }: MetricsRibbonProps) {
  return (
    <div className="px-4 sm:px-5 py-2">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Total Found — iOS widget-style card */}
        <div className="ios-card flex items-center gap-3 px-4 py-2.5">
          <div
            className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
            style={{ backgroundColor: isSearching ? 'rgba(0,122,255,0.1)' : 'rgba(0,122,255,0.1)' }}
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#007AFF' }} />
            ) : (
              <Users className="w-4 h-4" style={{ color: '#007AFF' }} />
            )}
          </div>
          <div>
            <p className="text-[11px] font-medium" style={{ color: '#8E8E93' }}>Total Found</p>
            <p className="text-[20px] font-bold tracking-[-0.3px]" style={{ color: '#1C1C1E' }}>
              {metrics.totalFound}
            </p>
          </div>
        </div>

        {/* Status text */}
        {status && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[8px]" style={{ backgroundColor: 'rgba(0,122,255,0.05)' }}>
            {isSearching && (
              <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#007AFF' }} />
            )}
            <span className="text-[13px]" style={{ color: '#3A3A3C' }}>{status}</span>
          </div>
        )}
      </div>
    </div>
  );
}
