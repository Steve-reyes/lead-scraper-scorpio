'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  CheckSquare,
  Square,
  Copy,
  ExternalLink,
  Star,
  Globe,
  Building2,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Table2,
  LayoutList,
} from 'lucide-react';
import type { Lead, EnrichmentStatus, LeadSource } from '@/lib/types';

interface LeadsTableProps {
  leads: Lead[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
}

function SourceBadge({ source }: { source: LeadSource }) {
  const config: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    google_maps: { label: 'Google', color: '#007AFF', icon: Building2 },
    yelp: { label: 'Yelp', color: '#FF3B30', icon: Search },
    yellowpages: { label: 'YP', color: '#FF9500', icon: Search },
    yell: { label: 'Yell', color: '#AF52DE', icon: Search },
    website_scrape: { label: 'Web', color: '#34C759', icon: Globe },
    directory: { label: 'Dir', color: '#8E8E93', icon: Building2 },
  };

  const cfg = config[source.type] || config.directory;

  return (
    <span
      className="inline-flex items-center gap-1 px-[6px] py-[2px] rounded-full text-[10px] font-medium"
      style={{
        backgroundColor: `${cfg.color}12`,
        color: cfg.color,
        border: `0.5px solid ${cfg.color}30`,
      }}
    >
      <cfg.icon className="w-[10px] h-[10px]" />
      {cfg.label}
    </span>
  );
}

function EnrichmentBadge({ status }: { status: EnrichmentStatus }) {
  const config: Record<EnrichmentStatus, { label: string; color: string; icon: React.ElementType }> = {
    pending: { label: 'Pending', color: '#8E8E93', icon: Clock },
    scanning_website: { label: 'Scraping', color: '#007AFF', icon: Loader2 },
    scanning_directories: { label: 'Directories', color: '#FF9500', icon: Loader2 },
    complete: { label: 'Done', color: '#34C759', icon: CheckCircle2 },
    failed: { label: 'Failed', color: '#FF3B30', icon: AlertCircle },
    cloudflare_locked: { label: 'Cloudflare', color: '#FF9500', icon: AlertCircle },
    enriched: { label: 'Enriched', color: '#34C759', icon: CheckCircle2 },
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

function LeadCard({ lead, selected, onToggle }: { lead: Lead; selected: boolean; onToggle: () => void }) {
  return (
    <div
      className="ios-card p-3.5 space-y-2.5 transition-all ios-btn-press"
      style={{
        borderColor: selected ? '#007AFF' : undefined,
        backgroundColor: selected ? 'rgba(0,122,255,0.04)' : undefined,
      }}
    >
      {/* Top row: checkbox + sources */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#E5E5EA', border: '0.5px solid #D1D1D6' }}
          >
            <Building2 className="w-3.5 h-3.5" style={{ color: '#8E8E93' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold truncate" style={{ color: '#1C1C1E' }}>{lead.businessName}</p>
            {lead.address && (
              <p className="text-[11px] truncate" style={{ color: '#8E8E93' }}>{lead.address}</p>
            )}
          </div>
        </div>
        <button
          onClick={onToggle}
          className="shrink-0 mt-0.5 ios-btn-press"
          style={{ color: selected ? '#007AFF' : '#8E8E93' }}
        >
          {selected ? (
            <CheckSquare className="w-[18px] h-[18px]" style={{ color: '#007AFF' }} />
          ) : (
            <Square className="w-[18px] h-[18px]" />
          )}
        </button>
      </div>

      {/* Fields */}
      <div className="space-y-1.5 text-[13px]">
        {lead.industry && (
          <div className="flex items-center gap-2">
            <span className="w-[48px] shrink-0 text-[11px]" style={{ color: '#8E8E93' }}>Industry</span>
            <span className="truncate" style={{ color: '#3A3A3C' }}>{lead.industry}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="w-[48px] shrink-0 text-[11px]" style={{ color: '#8E8E93' }}>Phone</span>
          {lead.phone ? (
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-mono truncate" style={{ color: '#3A3A3C' }}>{lead.phone}</span>
              <CopyButton text={lead.phone} />
            </div>
          ) : (
            <span style={{ color: '#C7C7CC' }}>-</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="w-[48px] shrink-0 text-[11px]" style={{ color: '#8E8E93' }}>Email</span>
          {lead.email ? (
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-medium truncate" style={{ color: '#007AFF' }}>{lead.email}</span>
              <CopyButton text={lead.email} />
            </div>
          ) : (
            <span style={{ color: '#C7C7CC' }}>-</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="w-[48px] shrink-0 text-[11px]" style={{ color: '#8E8E93' }}>Site</span>
          {lead.website ? (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium truncate hover:underline"
              style={{ color: '#007AFF' }}
            >
              <span className="truncate">{(() => { try { return new URL(lead.website).hostname; } catch { return lead.website; } })()}</span>
              <ExternalLink className="w-[11px] h-[11px] shrink-0" />
            </a>
          ) : (
            <span style={{ color: '#C7C7CC' }}>-</span>
          )}
        </div>

        {/* Rating + Sources row */}
        <div className="flex items-center justify-between pt-1.5" style={{ borderTop: '0.5px solid #E5E5EA' }}>
          <div className="flex items-center gap-1 flex-wrap">
            {lead.sources.map((source, idx) => (
              <SourceBadge key={idx} source={source} />
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {lead.rating && (
              <div className="flex items-center gap-1">
                <Star className="w-[11px] h-[11px]" style={{ color: '#FF9500', fill: '#FF9500' }} />
                <span className="text-[12px] font-medium" style={{ color: '#3A3A3C' }}>{lead.rating}</span>
                {lead.reviewCount && (
                  <span className="text-[10px]" style={{ color: '#8E8E93' }}>({lead.reviewCount})</span>
                )}
              </div>
            )}
            <EnrichmentBadge status={lead.enrichmentStatus} />
          </div>
        </div>

        {lead.enrichmentError && (
          <p className="text-[10px] truncate" style={{ color: '#FF3B30' }} title={lead.enrichmentError}>
            {lead.enrichmentError}
          </p>
        )}
      </div>
    </div>
  );
}

export default function LeadsTable({ leads, selectedIds, onSelectAll, onSelectOne }: LeadsTableProps) {
  const allSelected = leads.length > 0 && selectedIds.size === leads.length;
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Auto-detect mobile on mount
  useEffect(() => {
    const checkWidth = () => {
      if (window.innerWidth < 640) {
        setViewMode('card');
      }
    };
    checkWidth();
    const handler = () => {
      if (window.innerWidth < 640 && viewMode !== 'card') {
        setViewMode('card');
      }
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (leads.length === 0) {
    return null;
  }

  return (
    <div className="ios-card overflow-hidden">
      {/* Table Header with View Toggle */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '0.5px solid #E5E5EA', backgroundColor: '#F9F9FB' }}
      >
        <p className="text-[12px] font-medium" style={{ color: '#8E8E93' }}>
          Showing {leads.length} lead{leads.length !== 1 ? 's' : ''}
          {selectedIds.size > 0 && (
            <span style={{ color: '#007AFF' }}> · {selectedIds.size} selected</span>
          )}
        </p>
        <div
          className="flex items-center gap-0.5 rounded-[7px] p-[2px]"
          style={{ backgroundColor: '#E5E5EA' }}
        >
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] text-[12px] font-medium transition-all ${
              viewMode === 'table' ? 'ios-card' : ''
            }`}
            style={{
              color: viewMode === 'table' ? '#1C1C1E' : '#8E8E93',
              backgroundColor: viewMode === 'table' ? '#FFFFFF' : 'transparent',
              boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            }}
            title="Table view"
          >
            <Table2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Table</span>
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] text-[12px] font-medium transition-all ${
              viewMode === 'card' ? 'ios-card' : ''
            }`}
            style={{
              color: viewMode === 'card' ? '#1C1C1E' : '#8E8E93',
              backgroundColor: viewMode === 'card' ? '#FFFFFF' : 'transparent',
              boxShadow: viewMode === 'card' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            }}
            title="Card view"
          >
            <LayoutList className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cards</span>
          </button>
        </div>
      </div>

      {/* ======== TABLE VIEW ======== */}
      {viewMode === 'table' && (
        <div className="ios-scroll" style={{ overflowX: 'auto', overflowY: 'clip' }}>
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ backgroundColor: '#F9F9FB' }}>
                <th className="w-10 px-3 py-3 text-left">
                  <button
                    onClick={() => onSelectAll(!allSelected)}
                    className="ios-btn-press"
                    style={{ color: allSelected ? '#007AFF' : '#8E8E93' }}
                  >
                    {allSelected ? (
                      <CheckSquare className="w-[18px] h-[18px]" style={{ color: '#007AFF' }} />
                    ) : (
                      <Square className="w-[18px] h-[18px]" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>
                  Business Name
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>
                  Industry
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>
                  Phone
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>
                  Email
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>
                  Website
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>
                  Sources
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>
                  Rating
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="lead-row-enter transition-colors"
                  style={{
                    borderTop: '0.5px solid #E5E5EA',
                    backgroundColor: selectedIds.has(lead.id) ? 'rgba(0,122,255,0.04)' : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedIds.has(lead.id)) e.currentTarget.style.backgroundColor = '#F9F9FB';
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedIds.has(lead.id)) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td className="px-3 py-3">
                    <button
                      onClick={() => onSelectOne(lead.id, !selectedIds.has(lead.id))}
                      className="ios-btn-press"
                      style={{ color: selectedIds.has(lead.id) ? '#007AFF' : '#8E8E93' }}
                    >
                      {selectedIds.has(lead.id) ? (
                        <CheckSquare className="w-[18px] h-[18px]" style={{ color: '#007AFF' }} />
                      ) : (
                        <Square className="w-[18px] h-[18px]" />
                      )}
                    </button>
                  </td>

                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0"
                        style={{ backgroundColor: '#E5E5EA', border: '0.5px solid #D1D1D6' }}
                      >
                        <Building2 className="w-3.5 h-3.5" style={{ color: '#8E8E93' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold truncate max-w-[180px]" style={{ color: '#1C1C1E' }}>
                          {lead.businessName}
                        </p>
                        {lead.address && (
                          <p className="text-[11px] truncate max-w-[180px]" style={{ color: '#8E8E93' }}>
                            {lead.address}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    <span className="text-[13px]" style={{ color: '#3A3A3C' }}>{lead.industry || <span style={{ color: '#C7C7CC' }}>-</span>}</span>
                  </td>

                  <td className="px-3 py-3">
                    {lead.phone ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[13px] font-mono" style={{ color: '#3A3A3C' }}>{lead.phone}</span>
                        <CopyButton text={lead.phone} />
                      </div>
                    ) : (
                      <span className="text-[13px]" style={{ color: '#C7C7CC' }}>-</span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {lead.email ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[13px] font-medium truncate max-w-[160px]" style={{ color: '#007AFF' }}>
                          {lead.email}
                        </span>
                        <CopyButton text={lead.email} />
                      </div>
                    ) : (
                      <span className="text-[13px]" style={{ color: '#C7C7CC' }}>-</span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {lead.website ? (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[13px] font-medium hover:underline"
                        style={{ color: '#007AFF' }}
                      >
                        <span className="truncate max-w-[120px]">{(() => { try { return new URL(lead.website).hostname; } catch { return lead.website; } })()}</span>
                        <ExternalLink className="w-[11px] h-[11px] shrink-0" />
                      </a>
                    ) : (
                      <span className="text-[13px]" style={{ color: '#C7C7CC' }}>-</span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {lead.sources.map((source, idx) => (
                        <SourceBadge key={idx} source={source} />
                      ))}
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    {lead.rating ? (
                      <div className="flex items-center gap-1">
                        <Star className="w-[11px] h-[11px]" style={{ color: '#FF9500', fill: '#FF9500' }} />
                        <span className="text-[13px] font-medium" style={{ color: '#3A3A3C' }}>{lead.rating}</span>
                        {lead.reviewCount && (
                          <span className="text-[11px]" style={{ color: '#8E8E93' }}>({lead.reviewCount})</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[13px]" style={{ color: '#C7C7CC' }}>-</span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    <EnrichmentBadge status={lead.enrichmentStatus} />
                    {lead.enrichmentError && (
                      <p className="text-[10px] mt-0.5 truncate max-w-[100px]" style={{ color: '#FF3B30' }} title={lead.enrichmentError}>
                        {lead.enrichmentError}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ======== CARD VIEW ======== */}
      {viewMode === 'card' && (
        <div>
          {/* Select all bar */}
          <div
            className="px-4 py-2.5 flex items-center justify-between"
            style={{ borderBottom: '0.5px solid #E5E5EA', backgroundColor: '#F9F9FB' }}
          >
            <button
              onClick={() => onSelectAll(!allSelected)}
              className="flex items-center gap-1.5 text-[12px] font-medium ios-btn-press"
              style={{ color: '#8E8E93' }}
            >
              {allSelected ? (
                <CheckSquare className="w-3.5 h-3.5" style={{ color: '#007AFF' }} />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="p-3 space-y-3">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                selected={selectedIds.has(lead.id)}
                onToggle={() => onSelectOne(lead.id, !selectedIds.has(lead.id))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
