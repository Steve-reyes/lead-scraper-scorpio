'use client';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import {
  BarChart3,
  Users,
  Phone,
  Mail,
  Globe,
  TrendingUp,
  Target,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Activity,
  PieChart,
  AlertCircle,
} from 'lucide-react';

const PIPELINE_STAGES = [
  { id: 'new', label: 'New', color: '#007AFF' },
  { id: 'contacted', label: 'Contacted', color: '#FF9500' },
  { id: 'qualified', label: 'Qualified', color: '#34C759' },
  { id: 'closed', label: 'Won', color: '#30D158' },
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
  enrichmentStatus?: string;
}

interface EnrichedGroup {
  listName: string;
  leads: Lead[];
  enrichedAt: string;
}

function StatCard({ icon: Icon, label, value, sub, bgColor }: { icon: React.ElementType; label: string; value: string | number; sub?: string; bgColor: string }) {
  return (
    <div className="ios-card p-4 ios-page-enter">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium" style={{ color: '#8E8E93' }}>{label}</p>
          <p className="text-[28px] font-bold tracking-[-0.5px] mt-1" style={{ color: '#1C1C1E' }}>{value}</p>
          {sub && <p className="text-[11px] mt-0.5" style={{ color: '#8E8E93' }}>{sub}</p>}
        </div>
        <div className="w-9 h-9 rounded-[9px] flex items-center justify-center shrink-0" style={{ backgroundColor: bgColor }}>
          <Icon className="w-[18px] h-[18px] text-white" />
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [groups, setGroups] = useState<EnrichedGroup[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('enriched-businesses');
    if (!stored) return;
    try {
      const parsed: EnrichedGroup[] = JSON.parse(stored);
      for (const g of parsed) {
        for (const l of g.leads) {
          l.kanbanStatus = l.kanbanStatus || 'new';
          l.listName = g.listName;
        }
      }
      setGroups(parsed);
    } catch {}
  }, []);

  const allLeads = useMemo(() => groups.flatMap((g) => g.leads), [groups]);

  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of PIPELINE_STAGES) counts[s.id] = 0;
    for (const l of allLeads) {
      const k = l.kanbanStatus || 'new';
      if (counts[k] !== undefined) counts[k]++;
      else counts['new']++;
    }
    return counts;
  }, [allLeads]);

  const dataCompleteness = useMemo(() => {
    const total = allLeads.length || 1;
    return {
      withPhone: allLeads.filter((l) => l.phone).length,
      withEmail: allLeads.filter((l) => l.email).length,
      withWebsite: allLeads.filter((l) => l.website).length,
      withAll: allLeads.filter((l) => l.phone && l.email && l.website).length,
      phonePct: Math.round((allLeads.filter((l) => l.phone).length / total) * 100),
      emailPct: Math.round((allLeads.filter((l) => l.email).length / total) * 100),
      websitePct: Math.round((allLeads.filter((l) => l.website).length / total) * 100),
      completePct: Math.round((allLeads.filter((l) => l.phone && l.email && l.website).length / total) * 100),
    };
  }, [allLeads]);

  const listStats = useMemo(() => {
    return groups.map((g) => ({
      name: g.listName,
      total: g.leads.length,
      withEmail: g.leads.filter((l) => l.email).length,
      enrichedAt: g.enrichedAt,
    }));
  }, [groups]);

  const completionRate = useMemo(() => {
    if (allLeads.length === 0) return 0;
    const completed = pipelineCounts['closed'] || 0;
    return Math.round((completed / allLeads.length) * 100);
  }, [allLeads, pipelineCounts]);

  if (groups.length === 0) {
    return (
      <div className="flex h-screen" style={{ backgroundColor: '#F2F2F7' }}>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center ios-page-enter">
            <BarChart3 className="w-10 h-10 mx-auto mb-3" style={{ color: '#C7C7CC' }} />
            <p className="text-[14px]" style={{ color: '#8E8E93' }}>No data yet. Save leads from the Enrich page first.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#F2F2F7' }}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto ios-scroll scrollbar-thin">
        <div className="px-4 sm:px-5 pt-3 pb-1">
          <div className="ios-card p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" style={{ color: '#007AFF' }} />
              <h1 className="ios-title">Analytics</h1>
            </div>
            <p className="ios-caption2 mt-0.5">Overview of {allLeads.length} leads across {groups.length} lists</p>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-2 space-y-4 pb-6">
          {/* Top stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Users} label="Total Leads" value={allLeads.length} sub={`${groups.length} lists`} bgColor="rgba(0,122,255,0.15)" />
            <StatCard icon={Phone} label="With Phone" value={dataCompleteness.withPhone} sub={`${dataCompleteness.phonePct}%`} bgColor="rgba(0,122,255,0.15)" />
            <StatCard icon={Mail} label="With Email" value={dataCompleteness.withEmail} sub={`${dataCompleteness.emailPct}%`} bgColor="rgba(175,82,222,0.15)" />
            <StatCard icon={Globe} label="With Website" value={dataCompleteness.withWebsite} sub={`${dataCompleteness.websitePct}%`} bgColor="rgba(52,199,89,0.15)" />
          </div>

          {/* Pipeline breakdown */}
          <div className="ios-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4" style={{ color: '#007AFF' }} />
              <h2 className="text-[15px] font-semibold" style={{ color: '#1C1C1E' }}>Pipeline Distribution</h2>
            </div>
            <div className="space-y-3">
              {PIPELINE_STAGES.map((stage) => {
                const count = pipelineCounts[stage.id] || 0;
                const pct = allLeads.length > 0 ? Math.round((count / allLeads.length) * 100) : 0;
                return (
                  <div key={stage.id}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-[8px] h-[8px] rounded-full" style={{ backgroundColor: stage.color }} />
                        <span className="font-medium" style={{ color: '#3A3A3C' }}>{stage.label}</span>
                      </div>
                      <span style={{ color: '#8E8E93' }}>{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: '#E5E5EA' }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: stage.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data completeness */}
          <div className="ios-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-4 h-4" style={{ color: '#007AFF' }} />
              <h2 className="text-[15px] font-semibold" style={{ color: '#1C1C1E' }}>Data Completeness</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Phone', pct: dataCompleteness.phonePct, color: '#007AFF' },
                { label: 'Email', pct: dataCompleteness.emailPct, color: '#AF52DE' },
                { label: 'Website', pct: dataCompleteness.websitePct, color: '#34C759' },
                { label: 'All Three', pct: dataCompleteness.completePct, color: '#30D158' },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-[26px] font-bold tracking-[-0.5px]" style={{ color: '#1C1C1E' }}>{item.pct}%</p>
                  <p className="text-[12px] mt-1" style={{ color: '#8E8E93' }}>{item.label}</p>
                  <div className="w-full h-[5px] rounded-full mt-2 overflow-hidden" style={{ backgroundColor: '#E5E5EA' }}>
                    <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* List breakdown */}
          <div className="ios-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4" style={{ color: '#007AFF' }} />
              <h2 className="text-[15px] font-semibold" style={{ color: '#1C1C1E' }}>Leads by List</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9F9FB' }}>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>List</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>Total</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>Emails</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>Coverage</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>Enriched</th>
                  </tr>
                </thead>
                <tbody>
                  {listStats.map((ls) => (
                    <tr key={ls.name} className="transition-colors hover:bg-[#F9F9FB]" style={{ borderTop: '0.5px solid #E5E5EA' }}>
                      <td className="px-3 py-2.5 text-[13px] font-semibold" style={{ color: '#1C1C1E' }}>{ls.name}</td>
                      <td className="px-3 py-2.5 text-[13px]" style={{ color: '#3A3A3C' }}>{ls.total}</td>
                      <td className="px-3 py-2.5 text-[13px]" style={{ color: '#3A3A3C' }}>{ls.withEmail}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(52,199,89,0.12)', color: '#34C759' }}>
                          {ls.total > 0 ? Math.round((ls.withEmail / ls.total) * 100) : 0}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px]" style={{ color: '#8E8E93' }}>
                        {ls.enrichedAt ? new Date(ls.enrichedAt).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard icon={CheckCircle} label="Closed Won" value={pipelineCounts['closed'] || 0} sub={`${completionRate}% close rate`} bgColor="rgba(48,209,88,0.15)" />
            <StatCard icon={XCircle} label="Lost" value={pipelineCounts['lost'] || 0} bgColor="rgba(255,59,48,0.15)" />
            <StatCard icon={AlertCircle} label="Incomplete Data" value={pipelineCounts['incomplete'] || 0} sub="Missing email" bgColor="rgba(255,149,0,0.15)" />
          </div>
        </div>
      </div>
    </div>
  );
}
