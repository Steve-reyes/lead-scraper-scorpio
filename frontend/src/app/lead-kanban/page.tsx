'use client';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import {
  Phone,
  Mail,
  Globe,
  Building2,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  AlertCircle,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '';

const PIPELINE_STAGES = [
  { id: 'new', label: 'New Leads', color: '#007AFF' },
  { id: 'contacted', label: 'Contacted', color: '#FF9500' },
  { id: 'qualified', label: 'Qualified', color: '#34C759' },
  { id: 'closed', label: 'Closed Won', color: '#30D158' },
  { id: 'lost', label: 'Lost', color: '#FF3B30' },
  { id: 'incomplete', label: 'Incomplete', color: '#FF9500' },
];

interface Lead {
  id: string;
  businessName: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  kanbanStatus: string;
  listName?: string;
}

interface EnrichedGroup {
  listName: string;
  leads: Lead[];
  enrichedAt: string;
}

export default function LeadKanbanPage() {
  const [groups, setGroups] = useState<EnrichedGroup[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [collapsedCols, setCollapsedCols] = useState<Record<string, boolean>>({});
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load enriched groups from API first, fallback to localStorage
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/enriched-groups`);
        const data = await res.json();
        if (Array.isArray(data.groups) && data.groups.length > 0) {
          const parsed: EnrichedGroup[] = data.groups;
          for (const g of parsed) {
            for (const l of g.leads) {
              if (l.kanbanStatus !== 'contacted' && l.kanbanStatus !== 'qualified' &&
                  l.kanbanStatus !== 'closed' && l.kanbanStatus !== 'lost') {
                l.kanbanStatus = (!l.email) ? 'incomplete' : 'new';
              }
              l.listName = g.listName;
            }
          }
          setGroups(parsed);
          const expanded: Record<string, boolean> = {};
          for (const g of parsed) expanded[g.listName] = true;
          setExpandedLists(expanded);
          return;
        }
      } catch {}

      // Fallback: load from localStorage
      try {
        const stored = localStorage.getItem('enriched-businesses');
        if (!stored) return;
        const parsed: EnrichedGroup[] = JSON.parse(stored);
        for (const g of parsed) {
          for (const l of g.leads) {
            if (l.kanbanStatus !== 'contacted' && l.kanbanStatus !== 'qualified' &&
                l.kanbanStatus !== 'closed' && l.kanbanStatus !== 'lost') {
              l.kanbanStatus = (!l.email) ? 'incomplete' : 'new';
            }
            l.listName = g.listName;
          }
        }
        setGroups(parsed);
        const expanded: Record<string, boolean> = {};
        for (const g of parsed) expanded[g.listName] = true;
        setExpandedLists(expanded);
      } catch {}
    };
    load();
  }, []);

  // Persist kanbanStatus changes back to localStorage and API
  useEffect(() => {
    if (groups.length === 0) return;
    try {
      localStorage.setItem('enriched-businesses', JSON.stringify(groups));
    } catch {}
    // Also sync to API so Enriched Businesses page sees the changes
    for (const g of groups) {
      fetch(`${API}/api/enriched-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listName: g.listName, leads: g.leads, enrichedAt: g.enrichedAt }),
      }).catch(() => {});
    }
  }, [groups]);

  const moveLead = (listName: string, leadId: string, toStage: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.listName !== listName) return g;
        return {
          ...g,
          leads: g.leads.map((l) =>
            l.id === leadId ? { ...l, kanbanStatus: toStage } : l,
          ),
        };
      }),
    );
  };

  const handleDragStart = (id: string) => setDragId(id);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (listName: string, stageId: string) => {
    if (dragId) moveLead(listName, dragId, stageId);
    setDragId(null);
  };

  const copyText = (t: string) => {
    if (navigator.clipboard) navigator.clipboard.writeText(t);
  };

  const totalLeads = groups.reduce((sum, g) => sum + g.leads.length, 0);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of PIPELINE_STAGES) counts[s.id] = 0;
    for (const g of groups) {
      for (const l of g.leads) {
        const k = l.kanbanStatus || 'new';
        if (counts[k] !== undefined) counts[k]++;
        else counts['new']++;
      }
    }
    return counts;
  }, [groups]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F2F2F7' }}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-5 pt-3 pb-1">
          <div className="ios-card p-4">
            <div>
              <h1 className="ios-title">Lead Pipeline</h1>
              <p className="ios-caption2 mt-0.5">
                {totalLeads} leads · New: {stageCounts['new'] || 0} · Contacted: {stageCounts['contacted'] || 0} · Qualified: {stageCounts['qualified'] || 0} · Won: {stageCounts['closed'] || 0} · Lost: {stageCounts['lost'] || 0} · Incomplete: {stageCounts['incomplete'] || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Kanban Board — grouped by list */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-2 space-y-4 ios-scroll scrollbar-thin">
          {groups.length === 0 && (
            <div className="flex items-center justify-center h-48">
              <p className="text-[14px]" style={{ color: '#8E8E93' }}>
                No enriched leads yet. Save leads from the Enrich page first.
              </p>
            </div>
          )}
          {groups.map((group) => {
            const perStage: Record<string, Lead[]> = {};
            for (const s of PIPELINE_STAGES) perStage[s.id] = [];
            for (const l of group.leads) {
              const s = l.kanbanStatus || 'new';
              if (perStage[s]) perStage[s].push(l);
              else perStage['new'].push(l);
            }
            const isExpanded = expandedLists[group.listName] !== false;

            return (
              <div key={group.listName} className="ios-card overflow-hidden ios-page-enter">
                {/* List header */}
                <button
                  onClick={() => setExpandedLists((p) => ({ ...p, [group.listName]: !isExpanded }))}
                  className="w-full flex items-center justify-between px-5 py-3 ios-btn-press hover:bg-[#F9F9FB] transition-colors"
                  style={{ borderBottom: '0.5px solid #E5E5EA' }}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" style={{ color: '#8E8E93' }} />
                    ) : (
                      <ChevronRight className="w-4 h-4" style={{ color: '#8E8E93' }} />
                    )}
                    <h2 className="text-[14px] font-bold" style={{ color: '#1C1C1E' }}>{group.listName}</h2>
                    <span className="text-[12px]" style={{ color: '#8E8E93' }}>{group.leads.length} leads</span>
                  </div>
                  <span className="text-[11px]" style={{ color: '#8E8E93' }}>
                    New: {(perStage['new'] || []).length} · Contacted: {(perStage['contacted'] || []).length} · Lost: {(perStage['lost'] || []).length} · Incomplete: {(perStage['incomplete'] || []).length}
                  </span>
                </button>

                {/* Kanban columns for this list */}
                {isExpanded && (
                  <div className="overflow-x-auto ios-scroll">
                    <div className="flex gap-3 p-3 min-w-[900px]">
                      {PIPELINE_STAGES.map((stage) => {
                        const stageLeads = perStage[stage.id] || [];
                        return (
                          <div
                            key={stage.id}
                            className="flex-1 min-w-[170px] max-w-[260px] flex flex-col rounded-[10px]"
                            style={{ backgroundColor: '#F2F2F7', border: '0.5px solid #E5E5EA' }}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(group.listName, stage.id)}
                          >
                            {/* Column header */}
                            <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '0.5px solid #E5E5EA' }}>
                              <div className="flex items-center gap-1.5">
                                <div className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: stage.color }} />
                                <span className="text-[12px] font-semibold" style={{ color: '#3A3A3C' }}>{stage.label}</span>
                                <span className="text-[11px] ml-0.5" style={{ color: '#8E8E93' }}>{stageLeads.length}</span>
                              </div>
                              <button
                                onClick={() => setCollapsedCols((p) => ({ ...p, [stage.id]: !p[stage.id] }))}
                                className="ios-btn-press"
                                style={{ color: '#C7C7CC' }}
                              >
                                {collapsedCols[stage.id] ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            {/* Cards */}
                            <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5 max-h-[400px] ios-scroll">
                              {!collapsedCols[stage.id] &&
                                stageLeads.map((lead) => (
                                  <div
                                    key={lead.id}
                                    draggable
                                    onDragStart={() => handleDragStart(lead.id)}
                                    className="ios-card p-2.5 ios-btn-press transition-all cursor-grab active:cursor-grabbing"
                                    style={{
                                      opacity: dragId === lead.id ? 0.6 : 1,
                                      boxShadow: dragId === lead.id ? '0 0 0 2px #AF52DE' : undefined,
                                    }}
                                  >
                                    {/* Business name */}
                                    <div className="flex items-start gap-1.5 mb-1.5">
                                      <Building2 className="w-3 h-3 shrink-0 mt-0.5" style={{ color: '#8E8E93' }} />
                                      <p className="text-[12px] font-medium leading-tight truncate" style={{ color: '#1C1C1E' }}>{lead.businessName}</p>
                                    </div>

                                    {/* Contact info */}
                                    <div className="space-y-1">
                                      {lead.phone && (
                                        <div className="flex items-center gap-1 text-[11px]" style={{ color: '#3A3A3C' }}>
                                          <Phone className="w-[11px] h-[11px] shrink-0" style={{ color: '#8E8E93' }} />
                                          <span className="truncate">{lead.phone}</span>
                                          <button onClick={() => copyText(lead.phone!)} className="ml-auto ios-btn-press shrink-0" style={{ color: '#C7C7CC' }}>
                                            <Copy className="w-[9px] h-[9px]" />
                                          </button>
                                        </div>
                                      )}
                                      {lead.email && (
                                        <div className="flex items-center gap-1 text-[11px]" style={{ color: '#3A3A3C' }}>
                                          <Mail className="w-[11px] h-[11px] shrink-0" style={{ color: '#8E8E93' }} />
                                          <span className="truncate">{lead.email}</span>
                                          <button onClick={() => copyText(lead.email!)} className="ml-auto ios-btn-press shrink-0" style={{ color: '#C7C7CC' }}>
                                            <Copy className="w-[9px] h-[9px]" />
                                          </button>
                                        </div>
                                      )}
                                      {lead.website && (
                                        <div className="flex items-center gap-1 text-[11px]">
                                          <Globe className="w-[11px] h-[11px] shrink-0" style={{ color: '#8E8E93' }} />
                                          <a href={lead.website} target="_blank" rel="noopener noreferrer" className="truncate hover:underline max-w-[100px]" style={{ color: '#007AFF' }}>
                                            {lead.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}
                                          </a>
                                          <ExternalLink className="w-[9px] h-[9px] shrink-0" style={{ color: '#C7C7CC' }} />
                                        </div>
                                      )}
                                    </div>

                                    {/* Missing data badges */}
                                    {stage.id === 'incomplete' && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {!lead.phone && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,59,48,0.12)', color: '#FF3B30' }}>No Phone</span>}
                                        {!lead.email && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,59,48,0.12)', color: '#FF3B30' }}>No Email</span>}
                                        {!lead.website && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,59,48,0.12)', color: '#FF3B30' }}>No Website</span>}
                                        {lead.phone && lead.email && lead.website && (
                                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(52,199,89,0.12)', color: '#34C759' }}>Complete</span>
                                        )}
                                      </div>
                                    )}

                                    {/* Stage selector */}
                                    <div className="mt-1.5 pt-1.5" style={{ borderTop: '0.5px solid #F2F2F7' }}>
                                      <select
                                        value={lead.kanbanStatus}
                                        onChange={(e) => moveLead(group.listName, lead.id, e.target.value)}
                                        className="w-full text-[10px] rounded-[6px] px-1.5 py-1 cursor-pointer focus:outline-none"
                                        style={{ backgroundColor: '#F2F2F7', color: '#8E8E93', border: '0.5px solid #E5E5EA' }}
                                      >
                                        {PIPELINE_STAGES.map((s) => (
                                          <option key={s.id} value={s.id}>{s.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                ))}

                              {!collapsedCols[stage.id] && stageLeads.length === 0 && (
                                <div className="flex items-center justify-center py-6 text-[11px] italic" style={{ color: '#8E8E93' }}>
                                  Drop leads here
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
