'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import {
  Sparkles, Search, CheckSquare, Square, Loader2,
  Building2, ExternalLink, Copy, AlertCircle,
  CheckCircle2, Clock, Save, Globe, Filter,
  StopCircle, Trash2, Download, Upload,
} from 'lucide-react';
import type { Lead, WSMessage } from '@/lib/types';
import { connectWebSocket, disconnectWS, triggerBatchEnrich, triggerDeepBatchEnrich } from '@/lib/api';
import { useToast } from '@/components/Toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/** Enrichment status for the current page */
type EnrichPageStatus = 'idle' | 'enriching' | 'complete' | 'error';
type LeadEnrichState = 'pending' | 'scanning_website' | 'scanning_directories' | 'complete' | 'failed';

function StatusBadge({ status }: { status: LeadEnrichState }) {
  const config: Record<LeadEnrichState, { label: string; color: string; icon: React.ElementType }> = {
    pending: { label: 'Pending', color: '#8E8E93', icon: Clock },
    scanning_website: { label: 'Website', color: '#007AFF', icon: Loader2 },
    scanning_directories: { label: 'Directories', color: '#FF9500', icon: Loader2 },
    complete: { label: 'Done', color: '#34C759', icon: CheckCircle2 },
    failed: { label: 'Failed', color: '#FF3B30', icon: AlertCircle },
  };

  const cfg = config[status];
  const Icon = cfg.icon;

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: cfg.color }}>
      {status === 'scanning_website' || status === 'scanning_directories' ? (
        <Icon className="w-3 h-3 animate-spin" />
      ) : (
        <Icon className="w-3 h-3" />
      )}
      {cfg.label}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded-[6px] transition-colors hover:opacity-60"
      style={{ color: '#8E8E93' }}
      title="Copy to clipboard"
    >
      <Copy className="w-[12px] h-[12px]" />
    </button>
  );
}

export default function EnrichPage() {
  const { toast } = useToast();
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enrichStatus, setEnrichStatus] = useState<EnrichPageStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [activeListName, setActiveListName] = useState<string | null>(null);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showImportModal, setShowImportModal] = useState(false);
  const [savedLists, setSavedLists] = useState<{ name: string; leadCount: number }[]>([]);
  const [importTab, setImportTab] = useState<'list' | 'csv'>('list');

  // Poll interval ref for stop support
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // WebSocket refs
  const wsRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<string | null>(null);

  // Keep a mutable leads map for WS updates
  const leadsMapRef = useRef<Map<string, Lead>>(new Map());

  // Track last clicked index for shift-click range selection
  const lastClickedIndexRef = useRef<number | null>(null);

  // Shared poll — checks /api/leads for updated enrichment status and auto-completes when done
  const startEnrichPoll = useCallback((intervalMs = 3000) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setEnrichStatus('enriching');
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/leads`);
        const d = await r.json();
        const all = d.success ? d.leads : Array.isArray(d) ? d : [];
        setAllLeads((prev) => {
          const updated = prev.map((l) => {
            const found = all.find((x: any) => x.id === l.id);
            return found || l;
          });
          return updated;
        });
        const remaining = all.filter(
          (l: any) => l.enrichmentStatus === 'scanning_website' || l.enrichmentStatus === 'scanning_directories'
        );
        const done = all.filter((l: any) => l.enrichmentStatus === 'complete');
        const failed = all.filter((l: any) => l.enrichmentStatus === 'failed');
        if (remaining.length === 0) {
          clearInterval(poll);
          pollIntervalRef.current = null;
          setEnrichStatus('complete');
          setStatusMessage(`Enriched: ${done.length} done, ${failed.length} failed.`);
        } else {
          setStatusMessage(`Enriching... ${done.length + failed.length}/${all.length} done`);
        }
      } catch {}
    }, intervalMs);
    pollIntervalRef.current = poll;
  }, [API_BASE]);

  // Load imported leads from Saved Lists or restore from API
  useEffect(() => {
    const load = async () => {
      try {
        // First check for fresh import from Saved Lists page
        const storedLeads = localStorage.getItem('enrich-import-leads');
        const listName = localStorage.getItem('enrich-list-name');
        if (storedLeads) {
          const parsed: Lead[] = JSON.parse(storedLeads);
          setAllLeads(parsed);
          const map = new Map<string, Lead>();
          for (const lead of parsed) {
            map.set(lead.id, lead);
          }
          leadsMapRef.current = map;
          if (listName) {
            setActiveListName(listName);
            setStatusMessage('Imported from saved list');
          }
          localStorage.removeItem('enrich-import-leads');
          localStorage.removeItem('enrich-list-name');
          // Also persist to API so data survives browser/device switches
          try {
            await fetch(`${API_BASE}/api/leads`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ leads: parsed }),
            });
          } catch {}
          return;
        }

        // No fresh import — restore from API (cross-device persistence)
        const res = await fetch(`${API_BASE}/api/leads`);
        const data = await res.json();
        if (data.success && Array.isArray(data.leads) && data.leads.length > 0) {
          const parsed: Lead[] = data.leads.filter((l: Lead) => l.businessName);
          if (parsed.length > 0) {
            setAllLeads(parsed);
            const map = new Map<string, Lead>();
            for (const lead of parsed) map.set(lead.id, lead);
            leadsMapRef.current = map;
            setActiveListName('Restored Leads');
            setStatusMessage(`Restored ${parsed.length} leads from server`);
            // Check if any leads are still being enriched (survived browser refresh)
            const hasRunning = parsed.some(
              (l: Lead) => l.enrichmentStatus === 'scanning_website' || l.enrichmentStatus === 'scanning_directories'
            );
            if (hasRunning) {
              setStatusMessage(`Enrichment still running — ${parsed.filter((l: Lead) => l.enrichmentStatus === 'scanning_website' || l.enrichmentStatus === 'scanning_directories').length} leads in progress`);
              startEnrichPoll(3000);
            }
          }
        }
      } catch {
        console.warn('[Enrich Page] Could not load leads from API');
      }
    };
    load();
  }, [API_BASE]);

  // Connect WebSocket for enrichment streaming
  useEffect(() => {
    const ws = connectWebSocket(
      (data: WSMessage) => {
        switch (data.type) {
          case 'lead_enriched': {
            const { lead } = data.payload;
            if (lead) {
              // Update in leads map
              leadsMapRef.current.set(lead.id, lead);
              // Force re-render
              setAllLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)));
              // Persist to API so data survives browser/device switches
              const all = Array.from(leadsMapRef.current.values());
              fetch(`${API_BASE}/api/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leads: all }),
              }).catch(() => {});
            }
            break;
          }

          case 'enrich_complete': {
            setEnrichStatus('complete');
            setStatusMessage(data.payload.message || 'Enrichment complete!');
            // Final persist to API
            const all = Array.from(leadsMapRef.current.values());
            fetch(`${API_BASE}/api/leads`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ leads: all }),
            }).catch(() => {});
            break;
          }

          case 'progress': {
            setStatusMessage(data.payload.message || 'Processing...');
            break;
          }

          case 'enrich_cancelled': {
            setEnrichStatus('idle');
            setStatusMessage(data.payload?.message || 'Stopped');
            // Reset all scanning leads to failed so spinners disappear
            setAllLeads((prev) =>
              prev.map((l) =>
                l.enrichmentStatus === 'scanning_website' || l.enrichmentStatus === 'scanning_directories'
                  ? { ...l, enrichmentStatus: 'failed' as const, enrichmentError: 'cancelled' }
                  : l
              )
            );
            break;
          }

          case 'error': {
            setEnrichStatus('error');
            setStatusMessage(`Error: ${data.payload.error}`);
            break;
          }

          case 'connected':
          case 'registered': {
            const cid = data.payload?.clientId;
            if (cid) clientIdRef.current = cid;
            console.log('[Enrich WS]', data.type, data.payload);
            break;
          }
        }
      },
      (clientId) => {
        clientIdRef.current = clientId;
      },
    );
    wsRef.current = ws;

    return () => {
      disconnectWS();
      wsRef.current = null;
    };
  }, []);

  const sortLeads = (leads: Lead[]) => {
    if (!sortField) return leads;
    return [...leads].sort((a, b) => {
      let aVal = '';
      let bVal = '';
      if (sortField === 'status') {
        aVal = a.enrichmentStatus || '';
        bVal = b.enrichmentStatus || '';
      } else if (sortField === 'name') {
        aVal = (a.businessName || '').toLowerCase();
        bVal = (b.businessName || '').toLowerCase();
      } else if (sortField === 'phone') {
        aVal = (a.phone || '').toLowerCase();
        bVal = (b.phone || '').toLowerCase();
      } else if (sortField === 'website') {
        aVal = (a.website || '').toLowerCase();
        bVal = (b.website || '').toLowerCase();
      } else if (sortField === 'email') {
        aVal = (a.email || '').toLowerCase();
        bVal = (b.email || '').toLowerCase();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Filtered leads based on search query
  const filteredLeads = useMemo(() => {
    let result = allLeads;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = allLeads.filter(
        (l) =>
          l.businessName.toLowerCase().includes(q) ||
          (l.phone || '').includes(q) ||
          (l.website || '').toLowerCase().includes(q) ||
          (l.email || '').toLowerCase().includes(q) ||
          (l.address || '').toLowerCase().includes(q),
      );
    }
    return sortLeads(result);
  }, [allLeads, searchQuery, sortField, sortDir]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Count enrichment stats
  const stats = useMemo(() => {
    const total = allLeads.length;
    const withEmail = allLeads.filter((l) => l.email).length;
    const withPhone = allLeads.filter((l) => l.phone).length;
    const withWebsite = allLeads.filter((l) => l.website).length;
    const enriched = allLeads.filter((l) => l.enrichmentStatus === 'complete').length;
    return { total, withEmail, withPhone, withWebsite, enriched };
  }, [allLeads]);

  // Selection handlers
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [filteredLeads],
  );

  const handleSelectOne = useCallback((id: string, checked: boolean, index?: number, shiftKey?: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (shiftKey && index !== undefined && lastClickedIndexRef.current !== null) {
        // Shift-click: select range from last clicked to current
        const start = Math.min(lastClickedIndexRef.current, index);
        const end = Math.max(lastClickedIndexRef.current, index);
        for (let i = start; i <= end; i++) {
          next.add(filteredLeads[i].id);
        }
      } else {
        // Normal click
        if (checked) next.add(id);
        else next.delete(id);
      }

      if (index !== undefined) {
        lastClickedIndexRef.current = index;
      }
      return next;
    });
  }, [filteredLeads]);

  // Manually save enriched leads from this list to enriched-businesses (API)
  const saveToEnriched = useCallback(() => {
    const completed = allLeads.filter((l) => l.phone || l.email || l.website);
    if (completed.length === 0) {
      toast('No leads with data to save.', 'error');
      return;
    }
    const listName = activeListName || 'Unnamed List';
    const entry = {
      listName,
      leads: completed,
      enrichedAt: new Date().toISOString(),
    };
    // Save to backend API — primary persistence
    fetch(`${API_BASE}/api/enriched-groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listName, leads: completed, enrichedAt: entry.enrichedAt }),
    }).catch(() => {});
    toast(`Saved ${completed.length} leads to enriched businesses!`, 'success');
  }, [allLeads, activeListName, API_BASE, toast]);

  // Deep enrich selected leads (uses FlareSolverr for directory sites)
  const handleDeepEnrichSelected = useCallback(async () => {
    const selectedLeads = allLeads.filter((l) => selectedIds.has(l.id));
    if (selectedLeads.length === 0) return;

    setAllLeads((prev) =>
      prev.map((l) =>
        selectedIds.has(l.id) ? { ...l, enrichmentStatus: 'scanning_website' as const, enrichmentError: undefined } : l
      )
    );
    setEnrichStatus('enriching');
    setStatusMessage(`Deep enriching ${selectedLeads.length} leads via REST...`);

    try {
      // REST-only — no clientId, no WS dependency
      const res = await fetch(`${API_BASE}/api/enrich/deep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: selectedLeads }),
      });
      const result = await res.json();
      setStatusMessage(`Deep enrichment started — ${result.total} leads. Polling for results...`);

      // Poll for completion
      const poll = setInterval(async () => {
        try {
          const r = await fetch(`${API_BASE}/api/leads`);
          const d = await r.json();
          const all = d.success ? d.leads : Array.isArray(d) ? d : [];
          setAllLeads((prev) => {
            const updated = prev.map((l) => {
              const found = all.find((x: any) => x.id === l.id);
              return found || l;
            });
            return updated;
          });
          const remaining = all.filter(
            (l: any) => selectedIds.has(l.id) && (l.enrichmentStatus === 'pending' || l.enrichmentStatus === 'scanning_website' || l.enrichmentStatus === 'scanning_directories')
          );
          const done = all.filter((l: any) => selectedIds.has(l.id) && l.enrichmentStatus === 'complete');
          const failed = all.filter((l: any) => selectedIds.has(l.id) && l.enrichmentStatus === 'failed');
          if (remaining.length === 0) {
            clearInterval(poll);
            setEnrichStatus('complete');
            setStatusMessage(`Deep enriched: ${done.length} done, ${failed.length} failed.`);
          } else {
            setStatusMessage(`Deep enriched ${done.length}/${selectedLeads.length} leads...`);
          }
        } catch {}
      }, 5000);
      pollIntervalRef.current = poll;
    } catch (error: any) {
      setEnrichStatus('error');
      setStatusMessage(`Error: ${error.message}`);
    }
  }, [allLeads, selectedIds]);

  // Stop enrichment — POST to /api/enrich/stop + clear poll + reset spinners
  const handleStopEnrich = useCallback(() => {
    // Clear poll interval immediately so UI stops updating
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    // Hard-stop the backend job
    fetch(`${API_BASE}/api/enrich/stop`, { method: 'POST' }).catch(() => {});
    setEnrichStatus('idle');
    setStatusMessage('');
    // Reset any leads stuck in scanning to failed so spinners don't persist
    setAllLeads((prev) =>
      prev.map((l) =>
        l.enrichmentStatus === 'scanning_website' || l.enrichmentStatus === 'scanning_directories'
          ? { ...l, enrichmentStatus: 'failed' as const, enrichmentError: 'stopped' }
          : l
      )
    );
  }, [API_BASE]);

  // Clear all leads from enrichment page (and from API)
  const handleClearLeads = useCallback(() => {
    setAllLeads([]);
    setSelectedIds(new Set());
    setEnrichStatus('idle');
    setStatusMessage('');
    fetch(`${API_BASE}/api/leads`, { method: 'DELETE' }).catch(() => {});
  }, [API_BASE]);

  // Open import modal — fetch saved lists
  const handleOpenImport = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/saved-lists`);
      const data = await res.json();
      setSavedLists(data.lists || []);
    } catch {
      setSavedLists([]);
    }
    setImportTab('list');
    setShowImportModal(true);
  }, [API_BASE]);

  // Import leads from a saved list
  const handleImportFromList = useCallback(async (listName: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/saved-lists`);
      const data = await res.json();
      const list = (data.lists || []).find((l: any) => l.name === listName);
      if (!list || !Array.isArray(list.leads)) return;
      const leads: Lead[] = list.leads;
      setAllLeads(leads);
      const map = new Map<string, Lead>();
      for (const lead of leads) map.set(lead.id, lead);
      leadsMapRef.current = map;
      setActiveListName(listName);
      setStatusMessage(`Imported ${leads.length} leads from "${listName}"`);
      setShowImportModal(false);
      // Persist to API
      await fetch(`${API_BASE}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      }).catch(() => {});
    } catch {}
  }, [API_BASE]);

  // Parse CSV and import leads
  const handleImportCSV = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        toast('CSV must have a header row and at least one data row.', 'error');
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      const colMap: Record<string, number> = {};
      headers.forEach((h, i) => { colMap[h] = i; });
      // Map common column names
      const nameCol = colMap['businessname'] ?? colMap['business name'] ?? colMap['name'] ?? colMap['company'] ?? colMap['company name'];
      const phoneCol = colMap['phone'] ?? colMap['telephone'] ?? colMap['tel'] ?? colMap['phonenumber'] ?? colMap['phone number'];
      const emailCol = colMap['email'] ?? colMap['e-mail'] ?? colMap['mail'] ?? colMap['email address'];
      const websiteCol = colMap['website'] ?? colMap['web'] ?? colMap['site'] ?? colMap['url'];
      const addressCol = colMap['address'] ?? colMap['full address'] ?? colMap['location'];
      const cityCol = colMap['city'] ?? colMap['town'];
      const countryCol = colMap['country'];
      const industryCol = colMap['industry'] ?? colMap['category'] ?? colMap['keyword'];

      if (nameCol === undefined) {
        toast('CSV must have a "businessName" or "name" column.', 'error');
        return;
      }

      const leads: Lead[] = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
        const name = vals[nameCol]?.trim();
        if (!name) continue;
        leads.push({
          id: `csv-${i}-${Date.now()}`,
          businessName: name,
          phone: phoneCol !== undefined ? vals[phoneCol]?.trim() || '' : '',
          email: emailCol !== undefined ? vals[emailCol]?.trim() || '' : '',
          website: websiteCol !== undefined ? vals[websiteCol]?.trim() || '' : '',
          address: addressCol !== undefined ? vals[addressCol]?.trim() || '' : '',
          city: cityCol !== undefined ? vals[cityCol]?.trim() || '' : '',
          country: countryCol !== undefined ? vals[countryCol]?.trim() || '' : '',
          industry: industryCol !== undefined ? vals[industryCol]?.trim() || '' : '',
          enrichmentStatus: 'pending',
          sources: [],
          socialLinks: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      if (leads.length === 0) {
        toast('No valid leads found in CSV.', 'error');
        return;
      }

      setAllLeads(leads);
      const map = new Map<string, Lead>();
      for (const lead of leads) map.set(lead.id, lead);
      leadsMapRef.current = map;
      setActiveListName(file.name.replace(/\.csv$/i, ''));
      setStatusMessage(`Imported ${leads.length} leads from CSV`);
      setShowImportModal(false);
      // Persist to API
      await fetch(`${API_BASE}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      }).catch(() => {});
      toast(`Imported ${leads.length} leads from CSV!`, 'success');
    } catch (e: any) {
      toast(`CSV import failed: ${e.message}`, 'error');
    }
  }, [API_BASE, toast]);

  const handleEnrichSelected = useCallback(async () => {
    const selectedLeads = allLeads.filter((l) => selectedIds.has(l.id));
    if (selectedLeads.length === 0) return;

    // Reset status
    setAllLeads((prev) =>
      prev.map((l) =>
        selectedIds.has(l.id) ? { ...l, enrichmentStatus: 'scanning_website' as const, enrichmentError: undefined } : l
      )
    );
    setEnrichStatus('enriching');
    setStatusMessage(`Enriching ${selectedLeads.length} leads via REST...`);

    try {
      // REST-only — no clientId, no WS dependency
      // Enrichment continues even if browser closes
      const res = await fetch(`${API_BASE}/api/enrich/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: selectedLeads }),
      });
      const result = await res.json();
      setStatusMessage(`Enrichment started — ${result.total} leads. Polling for results...`);

      // Poll for completion
      const poll = setInterval(async () => {
        try {
          const r = await fetch(`${API_BASE}/api/leads`);
          const d = await r.json();
          const all = d.success ? d.leads : Array.isArray(d) ? d : [];
          // Update local leads with enriched data
          setAllLeads((prev) => {
            const updated = prev.map((l) => {
              const found = all.find((x: any) => x.id === l.id);
              return found || l;
            });
            return updated;
          });
          // Check if all selected are done
          const remaining = all.filter(
            (l: any) => selectedIds.has(l.id) && (l.enrichmentStatus === 'pending' || l.enrichmentStatus === 'scanning_website')
          );
          const done = all.filter((l: any) => selectedIds.has(l.id) && l.enrichmentStatus === 'complete');
          const failed = all.filter((l: any) => selectedIds.has(l.id) && l.enrichmentStatus === 'failed');
          if (remaining.length === 0) {
            clearInterval(poll);
            setEnrichStatus('complete');
            setStatusMessage(`Enriched ${done.length} leads, ${failed.length} failed.`);
          } else {
            setStatusMessage(`Enriched ${done.length}/${selectedLeads.length} leads...`);
          }
        } catch {}
      }, 3000);
      pollIntervalRef.current = poll;
    } catch (error: any) {
      setEnrichStatus('error');
      setStatusMessage(`Error: ${error.message}`);
    }
  }, [allLeads, selectedIds]);

  // Derived state
  const allSelected = filteredLeads.length > 0 && selectedIds.size === filteredLeads.length;
  const isEnriching = enrichStatus === 'enriching';
  const hasActiveJobs = isEnriching || allLeads.some(
    (l) => l.enrichmentStatus === 'scanning_website' || l.enrichmentStatus === 'scanning_directories'
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F2F2F7' }}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-5 pt-3 pb-1">
          <div className="ios-card p-3 sm:p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #AF52DE, #007AFF)' }}
                >
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="ios-title">Enrich Leads</h2>
                  <p className="ios-caption2">
                    {stats.total} leads · {stats.enriched} enriched · {stats.withEmail} with email
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter leads..."
                    className="ios-input text-[13px] pl-8 w-[160px] sm:w-[180px] h-[34px]"
                  />
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#8E8E93' }} />
                </div>

                {/* STOP button — always visible when any lead is in progress */}
                {hasActiveJobs && (
                  <button
                    onClick={handleStopEnrich}
                    className="ios-btn ios-btn-danger gap-1.5 text-[13px] h-[34px] px-4"
                  >
                    <StopCircle className="w-3.5 h-3.5" /> Stop
                  </button>
                )}

                {/* CLEAR button */}
                {!hasActiveJobs && allLeads.length > 0 && (
                  <button
                    onClick={handleClearLeads}
                    className="ios-btn-secondary gap-1.5 text-[13px] h-[34px] px-4"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear
                  </button>
                )}

                {/* IMPORT button */}
                {!hasActiveJobs && (
                  <button
                    onClick={handleOpenImport}
                    className="ios-btn-secondary gap-1.5 text-[13px] h-[34px] px-4"
                  >
                    <Download className="w-3.5 h-3.5" /> Import
                  </button>
                )}

                <button
                  onClick={handleDeepEnrichSelected}
                  disabled={selectedIds.size === 0 || hasActiveJobs}
                  className="ios-btn gap-1.5 text-[13px] h-[34px] px-4"
                  style={{ backgroundColor: '#34C759' }}
                >
                  {hasActiveJobs ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deep...</>
                  ) : (
                    <><Globe className="w-3.5 h-3.5" /> Deep ({selectedIds.size})</>
                  )}
                </button>

                <button
                  onClick={handleEnrichSelected}
                  disabled={selectedIds.size === 0 || hasActiveJobs}
                  className="ios-btn gap-1.5 text-[13px] h-[34px] px-4"
                  style={{ background: 'linear-gradient(135deg, #AF52DE, #007AFF)' }}
                >
                  {hasActiveJobs ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enriching...</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" /> Enrich ({selectedIds.size})</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {statusMessage && (
          <div className="mx-4 sm:mx-5 mb-1 px-3.5 py-2 rounded-[8px] flex items-center gap-2 text-[12px]" style={{
            backgroundColor:
              enrichStatus === 'error' ? '#FFF2F2' :
              enrichStatus === 'complete' ? '#F0FFF0' :
              'rgba(0,122,255,0.06)',
          }}>
            {isEnriching && <span className="inline-block w-[6px] h-[6px] rounded-full animate-pulse" style={{ backgroundColor: '#007AFF' }} />}
            {enrichStatus === 'complete' && <CheckCircle2 className="w-3 h-3" style={{ color: '#34C759' }} />}
            {enrichStatus === 'error' && <AlertCircle className="w-3 h-3" style={{ color: '#FF3B30' }} />}
            <span className="font-medium" style={{
              color: enrichStatus === 'error' ? '#FF3B30' : enrichStatus === 'complete' ? '#34C759' : '#3A3A3C',
            }}>{statusMessage}</span>
          </div>
        )}

        {activeListName && (
          <div
            className="mx-4 sm:mx-5 mb-1 px-3.5 py-2.5 rounded-[10px] flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, rgba(175,82,222,0.08), rgba(0,122,255,0.06))', border: '0.5px solid rgba(175,82,222,0.15)' }}
          >
            <div className="w-6 h-6 rounded-[7px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #AF52DE, #007AFF)' }}>
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="text-[13px] font-semibold" style={{ color: '#1C1C1E' }}>List: {activeListName}</span>
            <span className="text-[11px]" style={{ color: '#8E8E93' }}>({allLeads.length} leads)</span>
            <button
              onClick={() => setListCollapsed(!listCollapsed)}
              className="ml-2 text-[11px] font-medium ios-btn-press"
              style={{ color: '#8E8E93' }}
            >{listCollapsed ? 'Expand' : 'Collapse'}</button>
            {!hasActiveJobs && (
              <>
                <button
                  onClick={() => saveToEnriched()}
                  className="ml-auto text-[11px] font-medium ios-btn-press flex items-center gap-1"
                  style={{ color: '#AF52DE' }}
                ><Save className="w-3 h-3" /> Save</button>
                <button
                  onClick={() => { setActiveListName(null); setListCollapsed(false); }}
                  className="text-[11px] font-medium ios-btn-press"
                  style={{ color: '#8E8E93' }}
                >Dismiss</button>
              </>
            )}
          </div>
        )}

        {allLeads.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-center px-6">
            <div className="max-w-md ios-page-enter">
              <div
                className="w-[60px] h-[60px] mx-auto mb-4 rounded-[14px] flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(175,82,222,0.15), rgba(0,122,255,0.1))' }}
              >
                <Sparkles className="w-7 h-7" style={{ color: '#AF52DE' }} />
              </div>
              <h2 className="text-[20px] font-bold tracking-[-0.3px] mb-1" style={{ color: '#1C1C1E' }}>No leads to enrich</h2>
              <p className="text-[14px] leading-relaxed" style={{ color: '#8E8E93' }}>
                First, go to the <strong style={{ color: '#3A3A3C' }}>Search &amp; Scrape</strong> page and find some leads on Google Maps. Once the search completes, the leads will appear here ready for enrichment.
              </p>
            </div>
          </div>
        )}

        {allLeads.length > 0 && !listCollapsed && (
          <div className="flex-1 overflow-auto px-4 sm:px-5 py-2 ios-scroll scrollbar-thin">
            <div className="ios-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F9F9FB' }}>
                      <th className="w-10 px-3 py-3 text-left">
                        <button onClick={() => handleSelectAll(!allSelected)} className="ios-btn-press" style={{ color: '#8E8E93' }}>
                          {allSelected ? <CheckSquare className="w-[18px] h-[18px]" style={{ color: '#007AFF' }} /> : <Square className="w-[18px] h-[18px]" />}
                        </button>
                      </th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px] cursor-pointer select-none ios-btn-press" style={{ color: '#8E8E93' }} onClick={() => handleSort('name')}>
                        Business {sortField === 'name' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px] cursor-pointer select-none ios-btn-press" style={{ color: '#8E8E93' }} onClick={() => handleSort('phone')}>
                        Phone {sortField === 'phone' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px] cursor-pointer select-none ios-btn-press" style={{ color: '#8E8E93' }} onClick={() => handleSort('website')}>
                        Website {sortField === 'website' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px] cursor-pointer select-none ios-btn-press" style={{ color: '#8E8E93' }} onClick={() => handleSort('email')}>
                        Email {sortField === 'email' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px] cursor-pointer select-none ios-btn-press" style={{ color: '#8E8E93' }} onClick={() => handleSort('status')}>
                        Status {sortField === 'status' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead, idx) => (
                      <tr
                        key={lead.id}
                        className="lead-row-enter transition-colors"
                        style={{
                          borderTop: '0.5px solid #E5E5EA',
                          backgroundColor: selectedIds.has(lead.id) ? 'rgba(175,82,222,0.04)' : undefined,
                        }}
                        onMouseEnter={(e) => { if (!selectedIds.has(lead.id)) e.currentTarget.style.backgroundColor = '#F9F9FB'; }}
                        onMouseLeave={(e) => { if (!selectedIds.has(lead.id)) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <td className="px-3 py-3">
                          <button onClick={(e) => handleSelectOne(lead.id, !selectedIds.has(lead.id), idx, e.shiftKey)} className="ios-btn-press" style={{ color: selectedIds.has(lead.id) ? '#AF52DE' : '#8E8E93' }}>
                            {selectedIds.has(lead.id) ? <CheckSquare className="w-[18px] h-[18px]" style={{ color: '#AF52DE' }} /> : <Square className="w-[18px] h-[18px]" />}
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ backgroundColor: '#E5E5EA', border: '0.5px solid #D1D1D6' }}>
                              <Building2 className="w-3.5 h-3.5" style={{ color: '#8E8E93' }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[14px] font-semibold truncate max-w-[160px]" style={{ color: '#1C1C1E' }}>{lead.businessName}</p>
                              {lead.address && <p className="text-[11px] truncate max-w-[160px]" style={{ color: '#8E8E93' }}>{lead.address}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {lead.phone ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[13px] font-mono" style={{ color: '#3A3A3C' }}>{lead.phone}</span>
                              <CopyButton text={lead.phone} />
                            </div>
                          ) : <span className="text-[13px]" style={{ color: '#C7C7CC' }}>-</span>}
                        </td>
                        <td className="px-3 py-3">
                          {lead.website ? (
                            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium hover:underline" style={{ color: '#007AFF' }}>
                              <span className="truncate max-w-[110px]">{(() => { try { return new URL(lead.website).hostname; } catch { return lead.website; } })()}</span>
                              <ExternalLink className="w-[11px] h-[11px] shrink-0" />
                            </a>
                          ) : <span className="text-[13px]" style={{ color: '#C7C7CC' }}>-</span>}
                        </td>
                        <td className="px-3 py-3">
                          {lead.email ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[13px] font-medium truncate max-w-[160px]" style={{ color: '#AF52DE' }}>{lead.email}</span>
                              <CopyButton text={lead.email} />
                            </div>
                          ) : <span className="text-[13px]" style={{ color: '#C7C7CC' }}>-</span>}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={lead.enrichmentStatus as LeadEnrichState} />
                          {lead.enrichmentError && (
                            <p className="text-[10px] mt-0.5 truncate max-w-[100px]" style={{ color: '#FF3B30' }} title={lead.enrichmentError}>{lead.enrichmentError}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: '0.5px solid #E5E5EA', backgroundColor: '#F9F9FB' }}>
                <p className="text-[11px] font-medium" style={{ color: '#8E8E93' }}>
                  Showing {filteredLeads.length} of {allLeads.length} leads
                  {selectedIds.size > 0 && <span style={{ color: '#AF52DE' }}> · {selectedIds.size} selected</span>}
                </p>
                <div className="flex items-center gap-3 text-[11px]" style={{ color: '#8E8E93' }}>
                  <span>{stats.withWebsite} websites</span>
                  <span>{stats.withPhone} phones</span>
                  <span>{stats.withEmail} emails</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Import Modal ── */}
        {showImportModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            onClick={() => setShowImportModal(false)}
          >
            <div
              className="ios-card w-[400px] max-w-[90vw] max-h-[80vh] overflow-auto p-0"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '0.5px solid #E5E5EA' }}>
                <h3 className="text-[17px] font-semibold" style={{ color: '#1C1C1E' }}>Import Leads</h3>
                <button onClick={() => setShowImportModal(false)} className="text-[15px] font-medium ios-btn-press" style={{ color: '#007AFF' }}>Cancel</button>
              </div>

              {/* Tabs */}
              <div className="flex border-b" style={{ borderColor: '#E5E5EA' }}>
                <button
                  onClick={() => setImportTab('list')}
                  className="flex-1 py-2.5 text-[13px] font-semibold text-center transition-colors"
                  style={{
                    color: importTab === 'list' ? '#007AFF' : '#8E8E93',
                    borderBottom: importTab === 'list' ? '2px solid #007AFF' : '2px solid transparent',
                  }}
                >From Saved List</button>
                <button
                  onClick={() => setImportTab('csv')}
                  className="flex-1 py-2.5 text-[13px] font-semibold text-center transition-colors"
                  style={{
                    color: importTab === 'csv' ? '#007AFF' : '#8E8E93',
                    borderBottom: importTab === 'csv' ? '2px solid #007AFF' : '2px solid transparent',
                  }}
                >From CSV File</button>
              </div>

              {/* Saved List tab */}
              {importTab === 'list' && (
                <div className="p-4">
                  {savedLists.length === 0 ? (
                    <p className="text-[14px] text-center py-6" style={{ color: '#8E8E93' }}>
                      No saved lists found. Go to <strong style={{ color: '#3A3A3C' }}>Saved Lists</strong> to create one first.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-[300px] overflow-auto">
                      {savedLists.map((list) => (
                        <button
                          key={list.name}
                          onClick={() => handleImportFromList(list.name)}
                          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-[10px] text-left transition-colors hover:opacity-80"
                          style={{ backgroundColor: '#F2F2F7' }}
                        >
                          <span className="text-[14px] font-medium truncate" style={{ color: '#1C1C1E' }}>{list.name}</span>
                          <span className="text-[12px] shrink-0 ml-2" style={{ color: '#8E8E93' }}>{list.leadCount} leads</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CSV tab */}
              {importTab === 'csv' && (
                <div className="p-4">
                  <label
                    className="flex flex-col items-center justify-center py-10 px-4 rounded-[12px] border-2 border-dashed cursor-pointer transition-colors"
                    style={{ borderColor: '#C7C7CC', backgroundColor: '#F9F9FB' }}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#007AFF'; }}
                    onDragLeave={(e) => { e.currentTarget.style.borderColor = '#C7C7CC'; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = '#C7C7CC';
                      const file = e.dataTransfer.files[0];
                      if (file) handleImportCSV(file);
                    }}
                  >
                    <Upload className="w-8 h-8 mb-2" style={{ color: '#8E8E93' }} />
                    <p className="text-[14px] font-medium mb-1" style={{ color: '#3A3A3C' }}>Drop CSV file here or click to browse</p>
                    <p className="text-[11px]" style={{ color: '#8E8E93' }}>
                      Columns: businessName, phone, email, website, address, city, country
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImportCSV(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
