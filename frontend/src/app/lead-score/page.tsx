'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import {
  Target, TrendingUp, MessageSquare, Phone, Search,
  ChevronDown, ChevronUp, Trash2, Download, Clock,
  CheckCircle2, Zap, BarChart3, Globe, Edit3, Wand2,
  Sparkles, Save, X,
} from 'lucide-react';

interface LeadScoreCriteria {
  websiteQuality: number;
  reviewCount: number;
  googleMapsRank: number;
  socialMedia: number;
  responsiveness: number;
}

interface LeadScoreEntry {
  id: string;
  businessName: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  reviewCount?: number | null;
  rating?: number | null;
  socialLinks?: Record<string, string>;
  scores: LeadScoreCriteria;
  totalScore: number;
  tier: 'hot' | 'warm' | 'cold';
  scoredAt: string;
  notes?: string;
}

const SCORE_CFG: Record<string, { label: string; hint: string; max: number; auto: boolean; options: { value: number; label: string; desc: string }[]; }> = {
  websiteQuality: {
    label: 'Website Quality', hint: 'Outdated site = needs SEO more = higher priority', max: 3, auto: false,
    options: [
      { value: 1, label: 'Modern & mobile-friendly', desc: 'Low priority' },
      { value: 2, label: 'Mediocre', desc: 'Medium — could upgrade' },
      { value: 3, label: 'Outdated / poor', desc: 'High — needs SEO urgently' },
    ],
  },
  reviewCount: {
    label: 'Reviews Count', hint: 'Under 10 = struggling. 50+ = established. Both are opportunities.', max: 4, auto: true,
    options: [
      { value: 1, label: '10-49 reviews', desc: 'Some presence' },
      { value: 2, label: '⚠ No data', desc: 'Enrichment missed — review manually' },
      { value: 3, label: 'Under 10 reviews', desc: 'Struggling for reputation' },
      { value: 4, label: '50+ reviews', desc: 'Established — bigger opportunity' },
    ],
  },
  googleMapsRank: {
    label: 'Google Maps Rank', hint: 'Not ranking top 3 = need local SEO.', max: 2, auto: false,
    options: [
      { value: 1, label: 'In top 3', desc: 'Already ranking well' },
      { value: 2, label: 'Not in top 3', desc: 'Needs local SEO help' },
    ],
  },
  socialMedia: {
    label: 'Social Media', hint: 'No social = no pipeline. Easy upsell.', max: 1, auto: true,
    options: [
      { value: 0, label: 'Has social profiles', desc: 'Has some presence' },
      { value: 1, label: 'No social presence', desc: 'Upsell opportunity' },
    ],
  },
  responsiveness: {
    label: 'Responsiveness', hint: 'No answer = losing leads daily.', max: 1, auto: false,
    options: [
      { value: 0, label: 'Answered', desc: 'Responsive' },
      { value: 1, label: 'No answer', desc: 'Losing leads — urgent' },
    ],
  },
};

const API = process.env.NEXT_PUBLIC_API_URL || '';

function autoScore(lead: Partial<LeadScoreEntry>): LeadScoreCriteria {
  const websiteQuality = 2;
  let reviewCount = 2;
  if (lead.reviewCount !== undefined && lead.reviewCount !== null) {
    if (lead.reviewCount < 10) reviewCount = 3;
    else if (lead.reviewCount >= 50) reviewCount = 4;
    else if (lead.reviewCount >= 10) reviewCount = 1;
  }
  const googleMapsRank = 2;
  const socialLinks = lead.socialLinks || {};
  const socialMedia = Object.keys(socialLinks).length > 0 ? 0 : 1;
  const responsiveness = 0;
  return { websiteQuality, reviewCount, googleMapsRank, socialMedia, responsiveness };
}

function calcTotal(s: LeadScoreCriteria): number {
  return s.websiteQuality + s.reviewCount + s.googleMapsRank + s.socialMedia + s.responsiveness;
}

function getTier(score: number): 'hot' | 'warm' | 'cold' {
  if (score >= 8) return 'hot';
  if (score >= 5) return 'warm';
  return 'cold';
}

function tierMeta(tier: string) {
  switch (tier) {
    case 'hot': return { icon: Zap, color: '#FF3B30', bg: '#FFF2F2', badge: '#FF3B30', label: 'Contact within 24h' };
    case 'warm': return { icon: TrendingUp, color: '#FF9500', bg: '#FFF8F0', badge: '#FF9500', label: 'Add to sequence this week' };
    default: return { icon: Clock, color: '#007AFF', bg: '#F0F5FF', badge: '#007AFF', label: 'Bulk email campaign' };
  }
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

export default function LeadScorePage() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingLeads, setPendingLeads] = useState<LeadScoreEntry[]>([]);
  const [savedScores, setSavedScores] = useState<LeadScoreEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<LeadScoreCriteria | null>(null);
  const [filterTier, setFilterTier] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [showGuide, setShowGuide] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Load saved scores from API + pending from localStorage
  const loadSaved = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/lead-scores`);
      const data = await res.json();
      if (Array.isArray(data.entries)) setSavedScores(data.entries);
    } catch { /* offline fallback — try localStorage */
      try {
        const saved = JSON.parse(localStorage.getItem('lead-score-saved') || '[]');
        setSavedScores(saved);
      } catch {}
    }
  }, [API]);

  useEffect(() => {
    loadSaved();
    try {
      const q = JSON.parse(localStorage.getItem('lead-score-queue') || '[]');
      if (q.length > 0) {
        const mapped: LeadScoreEntry[] = q.map((l: any) => ({
          id: l.id || crypto.randomUUID(),
          businessName: l.businessName || '',
          phone: l.phone || '',
          email: l.email || '',
          website: l.website || '',
          address: l.address || '',
          reviewCount: l.reviewCount ?? l.reviews ?? null,
          rating: l.rating ?? null,
          socialLinks: l.socialLinks || {},
          scores: autoScore(l),
          totalScore: 0, tier: 'warm' as const, scoredAt: new Date().toISOString(),
        }));
        setPendingLeads(mapped);
        localStorage.removeItem('lead-score-queue');
      }
    } catch {}
  }, [loadSaved]);

  const persistSaved = async (entries: LeadScoreEntry[]) => {
    setSavedScores(entries);
    try {
      await fetch(`${API}/api/lead-scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
    } catch {
      localStorage.setItem('lead-score-saved', JSON.stringify(entries));
    }
  };

  const updateScore = (id: string, key: keyof LeadScoreCriteria, val: number) => {
    setPendingLeads((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const scores = { ...l.scores, [key]: val };
        const total = calcTotal(scores);
        return { ...l, scores, totalScore: total, tier: getTier(total) };
      })
    );
  };

  const analyzeAll = async () => {
    setLoading(true);
    const updated = pendingLeads.map((l) => {
      const total = calcTotal(l.scores);
      return { ...l, totalScore: total, tier: getTier(total), scoredAt: new Date().toISOString() };
    });
    await persistSaved([...updated, ...savedScores]);
    setPendingLeads([]);
    setLoading(false);
    setExpandedId(null);
  };

  const saveLead = async (entry: LeadScoreEntry) => {
    const total = calcTotal(entry.scores);
    const final = { ...entry, totalScore: total, tier: getTier(total), scoredAt: new Date().toISOString() };
    await persistSaved([final, ...savedScores]);
    setPendingLeads((prev) => prev.filter((l) => l.id !== entry.id));
    setExpandedId(null);
  };

  const removePending = (id: string) => {
    setPendingLeads((prev) => prev.filter((l) => l.id !== id));
    setExpandedId((prev) => prev === id ? null : prev);
  };

  const removeSaved = async (id: string) => {
    try { await fetch(`${API}/api/lead-scores/${id}`, { method: 'DELETE' }); } catch {}
    persistSaved(savedScores.filter((e) => e.id !== id));
  };

  const startEdit = (entry: LeadScoreEntry) => {
    setEditingId(entry.id);
    setEditValues({ ...entry.scores });
    setExpandedId(entry.id);
  };

  const saveEdit = async () => {
    if (!editingId || !editValues) return;
    const entry = savedScores.find((e) => e.id === editingId);
    if (!entry) return;
    const total = calcTotal(editValues);
    const updated = { ...entry, scores: editValues, totalScore: total, tier: getTier(total) };
    await persistSaved(savedScores.map((e) => e.id === editingId ? updated : e));
    setEditingId(null);
    setEditValues(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues(null);
  };

  const exportCSV = (entries: LeadScoreEntry[]) => {
    const h = ['Business Name', 'Phone', 'Email', 'Website', 'Score', 'Tier', 'Website Quality', 'Reviews', 'Maps Rank', 'Social', 'Responsiveness', 'Scored At'];
    const r = entries.map((e) => [
      `"${e.businessName.replace(/"/g, '""')}"`, `"${e.phone || ''}"`, `"${e.email || ''}"`, `"${e.website || ''}"`,
      e.totalScore, e.tier.toUpperCase(),
      e.scores.websiteQuality, e.scores.reviewCount, e.scores.googleMapsRank, e.scores.socialMedia, e.scores.responsiveness,
      `"${formatDate(e.scoredAt)}"`,
    ]);
    const csv = [h.join(','), ...r.map((x) => x.join(','))].join('\n');
    const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `lead-scores-${Date.now()}.csv`; a.click();
  };

  const filteredPending = useMemo(() => {
    let x = pendingLeads;
    if (filterTier !== 'all') x = x.filter((l) => l.tier === filterTier);
    if (searchQ) { const q = searchQ.toLowerCase(); x = x.filter((l) => l.businessName.toLowerCase().includes(q)); }
    return x;
  }, [pendingLeads, filterTier, searchQ]);

  const filteredSaved = useMemo(() => {
    let x = savedScores;
    if (filterTier !== 'all') x = x.filter((e) => e.tier === filterTier);
    if (searchQ) { const q = searchQ.toLowerCase(); x = x.filter((e) => e.businessName.toLowerCase().includes(q)); }
    return x;
  }, [savedScores, filterTier, searchQ]);

  // Kanban columns
  const hotLeads = useMemo(() => filteredSaved.filter((e) => e.tier === 'hot'), [filteredSaved]);
  const warmLeads = useMemo(() => filteredSaved.filter((e) => e.tier === 'warm'), [filteredSaved]);
  const coldLeads = useMemo(() => filteredSaved.filter((e) => e.tier === 'cold'), [filteredSaved]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F2F2F7' }}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-5 pt-3 pb-1">
          <div className="ios-card p-3 sm:p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF9500, #FF3B30)' }}>
                  <Target className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="ios-title">Lead Score</h2>
                  <p className="ios-caption2">{pendingLeads.length} pending · {savedScores.length} scored</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pendingLeads.length > 0 && (
                  <button onClick={analyzeAll} disabled={loading}
                    className="ios-btn gap-1.5 text-[13px] h-[34px] px-4"
                    style={{ background: 'linear-gradient(135deg, #FF9500, #FF3B30)' }}
                  >
                    {loading ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    Analyze All
                  </button>
                )}
                <button onClick={() => exportCSV(savedScores)} disabled={savedScores.length === 0}
                  className="ios-btn-secondary gap-1.5 text-[13px] h-[34px] px-3"
                ><Download className="w-3.5 h-3.5" /> Export</button>
              </div>
            </div>
            {/* Filters */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <div className="relative flex-1 max-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#8E8E93' }} />
                <input type="text" placeholder="Search business..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                  className="ios-input text-[13px] pl-8 h-[34px]"
                />
              </div>
              <div className="ios-segmented">
                {['all', 'hot', 'warm', 'cold'].map((t) => (
                  <button key={t} onClick={() => setFilterTier(t)}
                    className={`ios-segmented-item ${filterTier === t ? 'active' : ''}`}
                    style={{ color: filterTier === t ? (t === 'hot' ? '#FF3B30' : t === 'warm' ? '#FF9500' : t === 'cold' ? '#007AFF' : '#1C1C1E') : '#3A3A3C' }}
                  >{t === 'all' ? 'All' : t}</button>
                ))}
              </div>
              <button onClick={() => setViewMode(viewMode === 'list' ? 'kanban' : 'list')}
                className="ios-btn-secondary text-[12px] h-[32px] px-3"
              >{viewMode === 'list' ? 'Kanban' : 'List'}</button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-2 ios-scroll scrollbar-thin">
          {pendingLeads.length === 0 && savedScores.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-sm ios-page-enter">
                <div className="w-[60px] h-[60px] mx-auto mb-4 rounded-[14px] flex items-center justify-center" style={{ backgroundColor: '#E5E5EA' }}><Target className="w-7 h-7" style={{ color: '#C7C7CC' }} /></div>
                <h2 className="text-[20px] font-bold tracking-[-0.3px] mb-1" style={{ color: '#1C1C1E' }}>No leads to score</h2>
                <p className="text-[14px]" style={{ color: '#8E8E93' }}>Go to <strong style={{ color: '#3A3A3C' }}>Enriched Businesses</strong>, click <strong style={{ color: '#3A3A3C' }}>Score</strong> to forward leads here.</p>
                <button onClick={() => router.push('/enriched-businesses')} className="ios-btn mt-4 text-[14px]">Go to Enriched Businesses</button>
              </div>
            </div>
          ) : viewMode === 'kanban' && savedScores.length > 0 ? (
            <div className="h-full flex gap-4 pb-4 overflow-x-auto ios-scroll">
              {[
                { tier: 'hot', label: 'Hot Leads', action: 'Contact within 24h', icon: Zap, leads: hotLeads, scoreRange: '8-10' },
                { tier: 'warm', label: 'Warm Leads', action: 'Add to sequence this week', icon: TrendingUp, leads: warmLeads, scoreRange: '5-7' },
                { tier: 'cold', label: 'Cold Leads', action: 'Bulk email campaign', icon: Clock, leads: coldLeads, scoreRange: '1-4' },
              ].map((col) => {
                const tm = tierMeta(col.tier);
                const Ti = col.icon;
                return (
                  <div key={col.tier} className="flex-1 min-w-[260px] max-w-[340px] flex flex-col">
                    <div className="rounded-t-[10px] px-4 py-3" style={{ backgroundColor: tm.bg, border: '0.5px solid rgba(0,0,0,0.04)' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Ti className="w-4 h-4" style={{ color: tm.color }} /><span className="text-[14px] font-bold" style={{ color: '#1C1C1E' }}>{col.label}</span></div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E5E5EA', color: '#3A3A3C' }}>{col.leads.length}</span>
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: '#8E8E93' }}>Score {col.scoreRange} · {col.action}</p>
                    </div>
                    <div className="flex-1 rounded-b-[10px] p-3 space-y-2 overflow-y-auto ios-scroll" style={{ backgroundColor: tm.bg, border: '0.5px solid rgba(0,0,0,0.04)', borderTop: 'none' }}>
                      {col.leads.length === 0 ? (
                        <div className="flex items-center justify-center h-20 text-[12px] italic" style={{ color: '#8E8E93' }}>Drop leads here</div>
                      ) : col.leads.map((entry) => (
                        <div key={entry.id} className="ios-card p-3 group ios-btn-press">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-[13px] font-semibold leading-tight line-clamp-2 flex-1" style={{ color: '#1C1C1E' }}>{entry.businessName}</p>
                            <span className="shrink-0 text-[10px] font-bold px-[6px] py-[2px] rounded-full text-white" style={{ backgroundColor: tm.badge }}>{entry.totalScore}</span>
                          </div>
                          <div className="space-y-0.5 mb-2 text-[11px]" style={{ color: '#8E8E93' }}>
                            {entry.phone && <p><Phone className="w-[10px] h-[10px] inline mr-1" />{entry.phone}</p>}
                            {entry.email && <p><MessageSquare className="w-[10px] h-[10px] inline mr-1" />{entry.email}</p>}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(entry)} className="p-1 ios-btn-press" style={{ color: '#C7C7CC' }}><Edit3 className="w-3 h-3" /></button>
                            <button onClick={() => removeSaved(entry.id)} className="p-1 ml-auto ios-btn-press" style={{ color: '#C7C7CC' }}><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto pb-4">
              {/* Pending */}
              {filteredPending.length > 0 && (
                <div>
                  <h3 className="text-[14px] font-semibold mb-2 flex items-center gap-2" style={{ color: '#3A3A3C' }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FF9500' }}></span>
                    Pending Scoring ({filteredPending.length})
                    <button onClick={analyzeAll} disabled={loading}
                      className="ml-auto ios-btn gap-1 text-[12px] h-[30px] px-3"
                      style={{ background: 'linear-gradient(135deg, #FF9500, #FF3B30)' }}
                    >
                      <Wand2 className="w-3 h-3" /> Analyze All
                    </button>
                  </h3>
                  <div className="space-y-2">
                    {filteredPending.map((entry) => {
                      const tm = tierMeta(entry.tier);
                      const Ti = tm.icon;
                      const expanded = expandedId === entry.id;
                      return (
                        <div key={entry.id} className="ios-card overflow-hidden ios-page-enter">
                          <button onClick={() => setExpandedId(expanded ? null : entry.id)}
                            className="w-full flex items-center justify-between px-4 py-3 ios-btn-press hover:bg-[#F9F9FB] transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ backgroundColor: tm.bg, border: `0.5px solid ${tm.color}30` }}>
                                <Ti className="w-3.5 h-3.5" style={{ color: tm.color }} />
                              </div>
                              <div className="text-left min-w-0">
                                <p className="text-[14px] font-semibold truncate" style={{ color: '#1C1C1E' }}>{entry.businessName}</p>
                                <p className="text-[12px] truncate" style={{ color: '#8E8E93' }}>{entry.phone || entry.email || ''}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="flex items-center gap-1">
                                <span className="text-[18px] font-bold" style={{ color: tm.color }}>{calcTotal(entry.scores)}</span>
                                <span className="text-[12px]" style={{ color: '#8E8E93' }}>/10</span>
                              </div>
                              {expanded ? <ChevronUp className="w-4 h-4" style={{ color: '#8E8E93' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#8E8E93' }} />}
                            </div>
                          </button>
                          {expanded && (
                            <div className="px-4 py-3 space-y-3" style={{ borderTop: '0.5px solid #E5E5EA' }}>
                              {Object.entries(SCORE_CFG).map(([key, cfg]) => {
                                const k = key as keyof LeadScoreCriteria;
                                return (
                                  <div key={key}>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <label className="text-[12px] font-semibold" style={{ color: '#3A3A3C' }}>
                                        {cfg.label}
                                        {'auto' in cfg && cfg.auto && <span className="ml-1.5 text-[10px] font-normal px-1.5 py-0.5 rounded" style={{ backgroundColor: '#E5E5EA', color: '#8E8E93' }}>auto</span>}
                                      </label>
                                      <span className="text-[12px]" style={{ color: '#8E8E93' }}>{entry.scores[k]}/{cfg.max}</span>
                                    </div>
                                    <p className="text-[11px] mb-1.5" style={{ color: '#8E8E93' }}>{cfg.hint}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {cfg.options.map((opt, i) => (
                                        <button key={`${opt.value}-${i}`} onClick={() => updateScore(entry.id, k, opt.value)}
                                          className={`px-2.5 py-1.5 text-[11px] font-medium rounded-[8px] border text-left ios-btn-press transition-colors ${
                                            entry.scores[k] === opt.value ? '' : ''
                                          }`}
                                          style={{
                                            backgroundColor: entry.scores[k] === opt.value ? 'rgba(0,122,255,0.08)' : 'transparent',
                                            borderColor: entry.scores[k] === opt.value ? '#007AFF' : '#D1D1D6',
                                            color: entry.scores[k] === opt.value ? '#007AFF' : '#8E8E93',
                                          }}>
                                          <span className="block">{opt.label}</span>
                                          <span className="block text-[10px] font-normal mt-0.5" style={{ color: '#8E8E93' }}>{opt.desc}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                              <div className="flex items-center justify-between pt-3" style={{ borderTop: '0.5px solid #E5E5EA' }}>
                                <button onClick={() => removePending(entry.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] ios-btn-press rounded-[8px]" style={{ color: '#8E8E93' }}>
                                  <Trash2 className="w-3 h-3" /> Skip
                                </button>
                                <div className="flex items-center gap-2">
                                  <span className="text-[12px]" style={{ color: '#8E8E93' }}>Score: <strong style={{ color: tm.color }}>{calcTotal(entry.scores)}/10</strong></span>
                                  <button onClick={() => saveLead(entry)} className="ios-btn gap-1.5 text-[12px] py-1.5 px-4">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Save Score
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Saved Scored Leads */}
              {filteredSaved.length > 0 && (
                <div>
                  <h3 className="text-[14px] font-semibold mb-2 flex items-center gap-2" style={{ color: '#3A3A3C' }}>
                    <CheckCircle2 className="w-[18px] h-[18px]" style={{ color: '#34C759' }} />
                    Scored Leads ({filteredSaved.length})
                  </h3>
                  <div className="space-y-1">
                    {filteredSaved.map((entry) => {
                      const tm = tierMeta(entry.tier);
                      const Ti = tm.icon;
                      const isEditing = editingId === entry.id;
                      return (
                        <div key={entry.id} className="ios-card overflow-hidden ios-page-enter">
                          <div className="flex items-center justify-between px-4 py-2.5 hover:bg-[#F9F9FB] transition-colors">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-6 h-6 rounded-[7px] flex items-center justify-center shrink-0" style={{ backgroundColor: tm.bg, border: `0.5px solid ${tm.color}30` }}>
                                <Ti className="w-3 h-3" style={{ color: tm.color }} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[14px] font-semibold truncate" style={{ color: '#1C1C1E' }}>{entry.businessName}</p>
                                <div className="flex items-center gap-2 text-[12px]" style={{ color: '#8E8E93' }}>
                                  {entry.phone && <span>{entry.phone}</span>}
                                  {entry.email && <span>{entry.email}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[12px]" style={{ color: '#8E8E93' }}>{formatDate(entry.scoredAt)}</span>
                              <div className="flex items-center gap-1">
                                <span className="text-[16px] font-bold" style={{ color: tm.color }}>{entry.totalScore}</span>
                                <span className="text-[10px]" style={{ color: '#8E8E93' }}>/10</span>
                              </div>
                              <span className="text-[10px] font-bold px-[6px] py-[2px] rounded-full uppercase tracking-wide text-white" style={{ backgroundColor: tm.badge }}>{entry.tier}</span>
                              {isEditing ? (
                                <div className="flex gap-1">
                                  <button onClick={saveEdit} className="p-1 ios-btn-press" style={{ color: '#34C759' }}><Save className="w-3.5 h-3.5" /></button>
                                  <button onClick={cancelEdit} className="p-1 ios-btn-press" style={{ color: '#FF3B30' }}><X className="w-3.5 h-3.5" /></button>
                                </div>
                              ) : (
                                <div className="flex gap-1">
                                  <button onClick={() => startEdit(entry)} className="p-1 ios-btn-press" style={{ color: '#C7C7CC' }}><Edit3 className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => removeSaved(entry.id)} className="p-1 ios-btn-press" style={{ color: '#C7C7CC' }}><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Edit panel */}
                          {isEditing && editValues && (
                            <div className="px-4 py-3" style={{ borderTop: '0.5px solid #E5E5EA', backgroundColor: '#F9F9FB' }}>
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                {(Object.keys(SCORE_CFG) as (keyof LeadScoreCriteria)[]).map((key) => (
                                  <div key={key}>
                                    <label className="text-[10px] font-semibold block mb-1" style={{ color: '#3A3A3C' }}>{SCORE_CFG[key].label.replace(/ .*/, '')}</label>
                                    <select value={editValues[key]} onChange={(e) => setEditValues({ ...editValues, [key]: Number(e.target.value) })}
                                      className="w-full px-2 py-1.5 text-[11px] rounded-[8px] border focus:outline-none"
                                      style={{ borderColor: '#D1D1D6', backgroundColor: '#FFFFFF' }}
                                    >
                                      {SCORE_CFG[key].options.map((opt, i) => (
                                        <option key={`${opt.value}-${i}`} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scoring Guide */}
        <div className="px-4 sm:px-5 py-2">
          <div className="ios-card p-4 ios-page-enter">
            <button onClick={() => setShowGuide(!showGuide)} className="w-full text-[14px] font-semibold flex items-center gap-2" style={{ color: '#3A3A3C' }}>
              <BarChart3 className="w-4 h-4" style={{ color: '#AF52DE' }} /> About Lead Scoring
              {showGuide ? <ChevronUp className="w-4 h-4 ml-auto" style={{ color: '#8E8E93' }} /> : <ChevronDown className="w-4 h-4 ml-auto" style={{ color: '#8E8E93' }} />}
            </button>
            {showGuide && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-[13px] leading-relaxed" style={{ color: '#8E8E93' }}>
                <div className="space-y-2">
                  <p className="font-medium" style={{ color: '#3A3A3C' }}>Score Tiers</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#FF3B30' }}></span><span><strong style={{ color: '#3A3A3C' }}>Hot</strong> (8–10) — Contact within 24h</span></div>
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#FF9500' }}></span><span><strong style={{ color: '#3A3A3C' }}>Warm</strong> (5–7) — Add to sequence this week</span></div>
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#007AFF' }}></span><span><strong style={{ color: '#3A3A3C' }}>Cold</strong> (1–4) — Bulk email, low priority</span></div>
                  </div>
                  <p className="pt-1">Each lead scores <strong style={{ color: '#3A3A3C' }}>3–10</strong>. Calculated from 5 factors below.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-medium" style={{ color: '#3A3A3C' }}>5 Factors (Additive Model)</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li><strong style={{ color: '#3A3A3C' }}>Website Quality</strong> — Older/poorer sites = higher score</li>
                    <li><strong style={{ color: '#3A3A3C' }}>Review Count</strong> — Under 10 or 50+ = opportunity</li>
                    <li><strong style={{ color: '#3A3A3C' }}>Google Maps Rank</strong> — Low rank = higher SEO potential</li>
                    <li><strong style={{ color: '#3A3A3C' }}>Social Media</strong> — No social = needs help</li>
                    <li><strong style={{ color: '#3A3A3C' }}>Responsiveness</strong> — No phone/email = easier to reach</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
