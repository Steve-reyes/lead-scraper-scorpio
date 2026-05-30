'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import type { Lead } from '@/lib/types';
import {
  Building2, MapPin, Phone, Mail, Globe,
  ExternalLink, ChevronDown, ChevronRight,
  Trash2, Share2, Target, CheckCircle2,
  AlertCircle, Search, X, Download,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '';

interface EnrichedGroup {
  listName: string;
  leads: Lead[];
  enrichedAt: string;
}

export default function EnrichedBusinessesPage() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [groups, setGroups] = useState<EnrichedGroup[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [loading, setLoading] = useState(true);

  // Load from API, fall back to localStorage
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/enriched-groups`);
        const data = await res.json();
        if (Array.isArray(data.groups) && data.groups.length > 0) {
          setGroups(data.groups);
          setLoading(false);
          return;
        }
      } catch {}
      // Fallback: load from localStorage
      try {
        const stored = localStorage.getItem('enriched-businesses');
        if (stored) {
          const parsed: EnrichedGroup[] = JSON.parse(stored);
          if (parsed.length > 0) {
            setGroups(parsed);
            setLoading(false);
            return;
          }
        }
        // Fallback: backfill from enrich session
        const sessionLeads = localStorage.getItem('enrich-session-leads');
        const sessionName = localStorage.getItem('enrich-session-name');
        if (sessionLeads && sessionName) {
          const leads: Lead[] = JSON.parse(sessionLeads);
          const completed = leads.filter((l) => l.phone || l.email || l.website);
          if (completed.length > 0) {
            const entry: EnrichedGroup = {
              listName: sessionName,
              leads: completed,
              enrichedAt: new Date().toISOString(),
            };
            setGroups([entry]);
          }
        }
      } catch (e) {
        console.warn('[EnrichedBusinesses] Could not load enriched businesses');
      }
      setLoading(false);
    };
    load();
  }, [API]);

  // Save all groups to API whenever groups change
  useEffect(() => {
    if (groups.length === 0) return;
    const save = async () => {
      try {
        await Promise.all(groups.map((g) =>
          fetch(`${API}/api/enriched-groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              listName: g.listName,
              leads: g.leads,
              enrichedAt: g.enrichedAt,
            }),
          })
        ));
      } catch {}
    };
    save();
  }, [groups, API]);

  const totalEnriched = useMemo(
    () => groups.reduce((sum, g) => sum + g.leads.length, 0),
    [groups]
  );

  const toggleGroup = (name: string) => {
    setExpandedGroup((prev) => (prev === name ? null : name));
  };

  const forwardToScore = (leads: Lead | Lead[]) => {
    const items = Array.isArray(leads) ? leads : [leads];
    try {
      const existing = JSON.parse(localStorage.getItem('lead-score-queue') || '[]');
      localStorage.setItem('lead-score-queue', JSON.stringify([...existing, ...items]));
    } catch {
      localStorage.setItem('lead-score-queue', JSON.stringify(items));
    }
    router.push('/lead-score');
  };

  const deleteGroup = async (name: string) => {
    try {
      await fetch(`${API}/api/enriched-groups/${encodeURIComponent(name)}`, { method: 'DELETE' });
    } catch {}
    setGroups((prev) => prev.filter((g) => g.listName !== name));
    if (expandedGroup === name) setExpandedGroup(null);
  };

  const filteredGroups = useMemo(() => {
    if (!searchQ) return groups;
    const q = searchQ.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        leads: g.leads.filter(
          (l) =>
            l.businessName?.toLowerCase().includes(q) ||
            l.phone?.toLowerCase().includes(q) ||
            l.email?.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.leads.length > 0);
  }, [groups, searchQ]);

  const exportGroupCSV = (group: EnrichedGroup) => {
    const headers = ['Business Name', 'Address', 'Phone', 'Email', 'Website', 'LinkedIn', 'Sources'];
    const rows = group.leads.map((l) => [
      `"${(l.businessName || '').replace(/"/g, '""')}"`,
      `"${(l.address || '').replace(/"/g, '""')}"`,
      `"${l.phone || ''}"`,
      `"${l.email || ''}"`,
      `"${l.website || ''}"`,
      `"${l.socialLinks?.linkedin || ''}"`,
      `"${(l.sources || []).map((s) => s.name || s.type || String(s)).join('; ')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${group.listName.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
                  style={{ background: 'linear-gradient(135deg, #34C759, #007AFF)' }}
                >
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="ios-title">Enriched Businesses</h2>
                  <p className="ios-caption2">{groups.length} lists · {totalEnriched} leads</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#8E8E93' }} />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    className="ios-input text-[13px] pl-8 w-[160px] h-[34px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-2 ios-scroll scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="ios-spinner ios-spinner-lg" />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-sm ios-page-enter">
                <div className="w-[60px] h-[60px] mx-auto mb-4 rounded-[14px] flex items-center justify-center" style={{ backgroundColor: '#E5E5EA' }}>
                  <Building2 className="w-7 h-7" style={{ color: '#C7C7CC' }} />
                </div>
                <h2 className="text-[20px] font-bold tracking-[-0.3px] mb-1" style={{ color: '#1C1C1E' }}>No enriched businesses</h2>
                <p className="text-[14px]" style={{ color: '#8E8E93' }}>
                  Search for leads first, then enrich them. Results appear here.
                </p>
                <button
                  onClick={() => router.push('/?tab=search')}
                  className="ios-btn mt-4 text-[14px]"
                >
                  Go to Search
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-w-4xl mx-auto pb-4">
              {filteredGroups.map((group) => {
                const isExpanded = expandedGroup === group.listName;
                const hasEnriched = group.leads.some((l) => l.phone || l.email);
                return (
                  <div key={group.listName} className="ios-card overflow-hidden ios-page-enter">
                    {/* Group Header */}
                    <button
                      onClick={() => toggleGroup(group.listName)}
                      className="w-full flex items-center justify-between px-4 py-3.5 ios-btn-press transition-colors hover:bg-[#F9F9FB]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 shrink-0" style={{ color: '#8E8E93' }} />
                        ) : (
                          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: '#8E8E93' }} />
                        )}
                        <div className="text-left min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[14px] font-semibold truncate" style={{ color: '#1C1C1E' }}>{group.listName}</p>
                            {hasEnriched && (
                              <span className="ios-pill text-[10px]" style={{ backgroundColor: 'rgba(52,199,89,0.12)', color: '#34C759' }}>Enriched</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[12px]" style={{ color: '#8E8E93' }}>{group.leads.length} leads</span>
                            <span className="text-[12px]" style={{ color: '#8E8E93' }}>{new Date(group.enrichedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); forwardToScore(group.leads); }}
                          className="px-3 py-1.5 rounded-[8px] text-[11px] font-semibold gap-1 flex items-center"
                          style={{ backgroundColor: 'rgba(255,149,0,0.1)', color: '#FF9500', border: '0.5px solid rgba(255,149,0,0.2)' }}
                        >
                          <Target className="w-3 h-3" /> Score
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); exportGroupCSV(group); }}
                          className="p-1.5 rounded-[8px] ios-btn-press"
                          style={{ color: '#8E8E93' }}
                          title="Export CSV"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteGroup(group.listName); }}
                          className="p-1.5 rounded-[8px] ios-btn-press"
                          style={{ color: '#8E8E93' }}
                          title="Delete group"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </button>

                    {/* Group Leads */}
                    {isExpanded && (
                      <div style={{ borderTop: '0.5px solid #E5E5EA' }}>
                        {group.leads.length === 0 ? (
                          <div className="px-5 py-8 text-center text-[13px]" style={{ color: '#8E8E93' }}>No leads in this group</div>
                        ) : (
                          <div>
                            {group.leads.map((lead, idx) => (
                              <div
                                key={`${lead.businessName}-${idx}`}
                                className="px-4 py-3 transition-colors hover:bg-[#F9F9FB]"
                                style={{ borderTop: '0.5px solid #E5E5EA' }}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[14px] font-semibold" style={{ color: '#1C1C1E' }}>{lead.businessName}</p>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                      {lead.address && (
                                        <span className="flex items-center gap-1 text-[12px]" style={{ color: '#8E8E93' }}>
                                          <MapPin className="w-3 h-3 shrink-0" /> {lead.address}
                                        </span>
                                      )}
                                      {lead.phone && (
                                        <span className="flex items-center gap-1 text-[12px]" style={{ color: '#007AFF' }}>
                                          <Phone className="w-3 h-3 shrink-0" /> {lead.phone}
                                        </span>
                                      )}
                                      {lead.email && (
                                        <span className="flex items-center gap-1 text-[12px]" style={{ color: '#007AFF' }}>
                                          <Mail className="w-3 h-3 shrink-0" /> {lead.email}
                                        </span>
                                      )}
                                      {lead.website && (
                                        <a
                                          href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-[12px] hover:underline"
                                          style={{ color: '#007AFF' }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Globe className="w-3 h-3 shrink-0" />
                                          {lead.website.replace(/^https?:\/\//, '').slice(0, 30)}
                                          <ExternalLink className="w-[10px] h-[10px]" />
                                        </a>
                                      )}
                                    </div>
                                    {lead.rating && (
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[11px] font-medium" style={{ color: '#FF9500' }}>★ {lead.rating}</span>
                                        {lead.reviewCount !== undefined && lead.reviewCount !== null && (
                                          <span className="text-[11px]" style={{ color: '#8E8E93' }}>({lead.reviewCount} reviews)</span>
                                        )}
                                      </div>
                                    )}
                                    {lead.sources && lead.sources.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {lead.sources.map((src, i) => (
                                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#E5E5EA', color: '#8E8E93' }}>
                                            {src.name || src.type || String(src)}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {lead.enrichmentStatus === 'cloudflare_locked' && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <AlertCircle className="w-3 h-3" style={{ color: '#FF9500' }} />
                                        <span className="text-[11px] font-medium" style={{ color: '#FF9500' }}>Cloudflare Locked</span>
                                      </div>
                                    )}
                                    {lead.enrichmentStatus === 'enriched' && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <CheckCircle2 className="w-3 h-3" style={{ color: '#34C759' }} />
                                        <span className="text-[11px] font-medium" style={{ color: '#34C759' }}>Enriched</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Right: enrichment data badges */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    {lead.phone && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(52,199,89,0.12)', color: '#34C759' }}>Phone</span>
                                    )}
                                    {lead.email && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,122,255,0.12)', color: '#007AFF' }}>Email</span>
                                    )}
                                    {lead.website && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(175,82,222,0.12)', color: '#AF52DE' }}>Site</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
