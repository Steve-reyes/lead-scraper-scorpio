'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import MetricsRibbon from '@/components/MetricsRibbon';
import LeadsTable from '@/components/LeadsTable';
import ExportFooter from '@/components/ExportFooter';
import { useToast } from '@/components/Toast';
import { Search, Loader2 } from 'lucide-react';
import type { Lead, Metrics, WSMessage } from '@/lib/types';
import { connectWebSocket, triggerSearch } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function Home() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [metrics, setMetrics] = useState<Metrics>({
    totalFound: 0,
    enrichedWithEmail: 0,
    phonesFound: 0,
    fallbackSitesScraped: 0,
  });
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(50);
  const [sortField, setSortField] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [streaming, setStreaming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const leadsMapRef = useRef<Map<string, Lead>>(new Map());
  const onMessageRef = useRef<((data: WSMessage) => void) | null>(null);
  const [leadsLoaded, setLeadsLoaded] = useState(false);

  // Handle incoming WebSocket messages
  const handleWSMessage = useCallback((data: WSMessage) => {
    switch (data.type) {
      case 'lead_found': {
        const { lead, totalFound } = data.payload;
        leadsMapRef.current.set(lead.id, lead);
        setLeads((prev) => [...prev, lead]);
        setMetrics((prev) => ({ ...prev, totalFound }));
        setStreaming(true);
        break;
      }

      case 'progress': {
        setSearchStatus(data.payload.message);
        if (data.payload.totalFound) {
          setMetrics((prev) => ({ ...prev, totalFound: data.payload.totalFound! }));
        }
        break;
      }

      case 'complete': {
        setIsSearching(false);
        setStreaming(false);
        setSearchStatus(data.payload.message || 'Complete');
        setMetrics({
          totalFound: data.payload.totalFound,
          enrichedWithEmail: 0,
          phonesFound: 0,
          fallbackSitesScraped: 0,
        });
        const currentLeads = Array.from(leadsMapRef.current.values());
        if (currentLeads.length > 0) {
          fetch(`${API_BASE}/api/leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leads: currentLeads }),
          }).catch(() => {});
          toast(`Found ${currentLeads.length} businesses on Google Maps`, 'success');
        }
        break;
      }

      case 'error': {
        setIsSearching(false);
        setStreaming(false);
        setSearchStatus(`Error: ${data.payload.error}`);
        toast(`Search failed: ${data.payload.error}`, 'error');
        break;
      }

      case 'connected':
      case 'registered': {
        console.log('[WS] Registered:', data.payload);
        break;
      }
    }
  }, [toast]);

  onMessageRef.current = handleWSMessage;

  // Auto-connect WebSocket on mount
  useEffect(() => {
    const ws = connectWebSocket(
      (data) => {
        if (onMessageRef.current) onMessageRef.current(data);
      },
      (clientId) => {
        clientIdRef.current = clientId;
        console.log('[WS] Assigned clientId:', clientId);
      },
    );
    wsRef.current = ws;
    return () => { ws.close(); wsRef.current = null; };
  }, []);

  // Restore leads from backend on mount
  useEffect(() => {
    const restore = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/leads`);
        const data = await res.json();
        if (data.success && Array.isArray(data.leads) && data.leads.length > 0) {
          const restoredLeads = data.leads;
          setLeads(restoredLeads);
          setMetrics((prev) => ({ ...prev, totalFound: restoredLeads.length }));
          const map = new Map<string, Lead>();
          for (const lead of restoredLeads) map.set(lead.id, lead);
          leadsMapRef.current = map;
          setSearchStatus(`Restored ${restoredLeads.length} leads`);
        }
      } catch {}
      setLeadsLoaded(true);
    };
    restore();
  }, [API_BASE]);

  // Send search via POST /api/search → WebSocket streaming
  const handleSearch = useCallback(
    async (keyword: string, location: string, country: string, radiusKm: number = 0) => {
      setLeads([]);
      setSelectedIds(new Set());
      setMetrics({ totalFound: 0, enrichedWithEmail: 0, phonesFound: 0, fallbackSitesScraped: 0 });
      setIsSearching(true);
      setStreaming(false);
      setSearchStatus('Starting search...');
      leadsMapRef.current.clear();
      setDisplayLimit(50);

      const waitForWs = () =>
        new Promise<void>((resolve) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) { resolve(); return; }
          const check = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) { clearInterval(check); resolve(); }
          }, 100);
          setTimeout(() => { clearInterval(check); resolve(); }, 5000);
        });

      await waitForWs();

      try {
        const result = await triggerSearch(
          { keyword, location, country, radius: radiusKm, maxResults: 500 },
          clientIdRef.current || undefined,
        );
        setSearchStatus(result.message || `Searching Google Maps for "${keyword}" in "${location}"...`);
      } catch (error: any) {
        setIsSearching(false);
        setSearchStatus(`Error: ${error.message}`);
      }
    },
    [],
  );

  // Selection handlers
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) setSelectedIds(new Set(leads.map((l) => l.id)));
      else setSelectedIds(new Set());
    },
    [leads],
  );

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Sorting
  const handleSort = useCallback((field: string) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }, [sortField]);

  const sortLeads = useCallback((list: Lead[]) => {
    if (!sortField) return list;
    return [...list].sort((a, b) => {
      let aVal = '';
      let bVal = '';
      if (sortField === 'name') { aVal = (a.businessName || '').toLowerCase(); bVal = (b.businessName || '').toLowerCase(); }
      else if (sortField === 'phone') { aVal = (a.phone || '').toLowerCase(); bVal = (b.phone || '').toLowerCase(); }
      else if (sortField === 'email') { aVal = (a.email || '').toLowerCase(); bVal = (b.email || '').toLowerCase(); }
      else if (sortField === 'website') { aVal = (a.website || '').toLowerCase(); bVal = (b.website || '').toLowerCase(); }
      else if (sortField === 'rating') { aVal = String(a.rating || ''); bVal = String(b.rating || ''); }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sortField, sortDir]);

  // Filter + sort
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = leads.filter((l) =>
        l.businessName.toLowerCase().includes(q) ||
        (l.phone || '').includes(q) ||
        (l.website || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.address || '').toLowerCase().includes(q),
      );
    }
    return sortLeads(result);
  }, [leads, searchQuery, sortLeads]);

  const displayLeads = filteredLeads.slice(0, displayLimit);

  // Export
  const selectedLeads = leads.filter((l) => selectedIds.has(l.id));

  const handleExportCSV = useCallback(() => {
    const headers = ['Business Name', 'Industry', 'Phone', 'Email', 'Website', 'Address', 'Rating'];
    const rows = selectedLeads.map((l) => [
      `"${l.businessName.replace(/"/g, '""')}"`,
      `"${l.industry || ''}"`,
      `"${l.phone || ''}"`,
      `"${l.email || ''}"`,
      `"${l.website || ''}"`,
      `"${(l.address || '').replace(/"/g, '""')}"`,
      l.rating || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${selectedLeads.length} leads`, 'success');
  }, [selectedLeads, toast]);

  const handleSaveList = useCallback(() => {
    const listName = prompt('Enter a name for this list:');
    if (!listName) return;
    fetch(`${API_BASE}/api/saved-lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: listName, leads: selectedLeads, createdAt: new Date().toISOString() }),
    }).catch(() => {});
    toast(`Saved ${selectedLeads.length} leads to "${listName}"`, 'success');
  }, [selectedLeads, API_BASE, toast]);

  const isConnected = wsRef.current?.readyState === WebSocket.OPEN;

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F2F2F7' }}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onSearch={handleSearch} isSearching={isSearching} onClear={() => {
          setLeads([]);
          setSelectedIds(new Set());
          setMetrics({ totalFound: 0, enrichedWithEmail: 0, phonesFound: 0, fallbackSitesScraped: 0 });
          setSearchStatus('');
          leadsMapRef.current.clear();
          fetch(`${API_BASE}/api/leads`, { method: 'DELETE' }).catch(() => {});
          setDisplayLimit(50);
          toast('Cleared all leads', 'info');
        }} leadsCount={leads.length} />

        <MetricsRibbon metrics={metrics} isSearching={isSearching} status={searchStatus} />

        {searchStatus && (
          <div className="mx-4 sm:mx-5 mb-1 px-3.5 py-2 rounded-[8px] flex items-center gap-2 text-[12px]"
            style={{ backgroundColor: 'rgba(0,122,255,0.06)' }}>
            {isSearching && <span className="inline-block w-[6px] h-[6px] rounded-full animate-pulse shrink-0" style={{ backgroundColor: '#007AFF' }} />}
            {!isConnected && isSearching && <span className="font-medium shrink-0" style={{ color: '#FF9500' }}>[WS reconnecting] </span>}
            <span className="break-words" style={{ color: '#3A3A3C' }}>{searchStatus}</span>
          </div>
        )}

        {/* Search/filter bar */}
        {leads.length > 0 && (
          <div className="px-4 sm:px-5 mb-1.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#8E8E93' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter leads by name, phone, email, website, address..."
                className="ios-input pl-9 text-[13px] h-[34px] w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium ios-btn-press"
                  style={{ color: '#8E8E93' }}
                >
                  Clear
                </button>
              )}
            </div>
            {filteredLeads.length < leads.length && (
              <p className="text-[11px] mt-1" style={{ color: '#8E8E93' }}>
                Showing {filteredLeads.length} of {leads.length} leads
              </p>
            )}
          </div>
        )}

        {/* Data Table */}
        <div className="flex-1 overflow-auto px-4 sm:px-5 py-2 ios-scroll scrollbar-thin">
          <LeadsTable
            leads={displayLeads}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectOne={handleSelectOne}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
          />

          {displayLimit < filteredLeads.length && (
            <div className="flex justify-center mt-4 mb-6">
              <button
                onClick={() => setDisplayLimit((prev) => prev + 50)}
                className="ios-btn-secondary text-[13px] px-6 py-2.5"
              >
                Load More ({filteredLeads.length - displayLimit} more)
              </button>
            </div>
          )}
        </div>

        {/* Empty State */}
        {leads.length === 0 && !isSearching && !streaming && (
          <div className="flex-1 flex items-center justify-center text-center px-4 sm:px-6">
            <div className="max-w-md ios-page-enter">
              <div className="w-[56px] h-[56px] sm:w-[64px] sm:h-[64px] mx-auto mb-5 rounded-[14px] flex items-center justify-center"
                style={{ backgroundColor: '#E5E5EA' }}>
                <svg className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: '#8E8E93' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <h2 className="text-[20px] font-bold tracking-[-0.3px] mb-1.5" style={{ color: '#1C1C1E' }}>Search for leads</h2>
              <p className="text-[14px] leading-relaxed" style={{ color: '#8E8E93' }}>
                Enter a keyword and location above to find local businesses on Google Maps.
              </p>
            </div>
          </div>
        )}

        {/* Loading skeleton while streaming */}
        {streaming && leads.length > 0 && (
          <div className="px-4 sm:px-5 pb-2 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="ios-card p-4 flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-[8px]" style={{ backgroundColor: '#E5E5EA' }} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/5 rounded-full" style={{ backgroundColor: '#E5E5EA' }} />
                  <div className="h-2.5 w-2/5 rounded-full" style={{ backgroundColor: '#E5E5EA' }} />
                </div>
                <div className="flex gap-1.5">
                  <div className="w-12 h-5 rounded-full" style={{ backgroundColor: '#E5E5EA' }} />
                  <div className="w-12 h-5 rounded-full" style={{ backgroundColor: '#E5E5EA' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Initial progress spinner */}
        {isSearching && leads.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="ios-spinner ios-spinner-lg" />
              <p className="text-[13px]" style={{ color: '#8E8E93' }}>Searching Google Maps...</p>
            </div>
          </div>
        )}

        <ExportFooter
          selectedCount={selectedIds.size}
          totalCount={leads.length}
          onExportCSV={handleExportCSV}
          onSaveList={handleSaveList}
        />
      </div>
    </div>
  );
}
