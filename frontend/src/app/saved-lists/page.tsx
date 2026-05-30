'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { List, Search, Building2, ChevronDown, ChevronRight, ExternalLink, Calendar, Users, Sparkles } from 'lucide-react';
import type { Lead } from '@/lib/types';

interface SavedList {
  name: string;
  leads: Lead[];
  createdAt: string;
  leadCount: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function SavedListsPage() {
  const router = useRouter();
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [expandedList, setExpandedList] = useState<string | null>(null);
  const [loadedLeads, setLoadedLeads] = useState<Lead[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load saved lists from API on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/saved-lists`);
        const data = await res.json();
        if (Array.isArray(data.lists)) {
          setSavedLists(data.lists);
        }
      } catch {
        console.warn('[SavedLists] Could not load from API');
      }
      setLoading(false);
    };
    load();
  }, [API_BASE]);

  const handleToggleList = (listName: string) => {
    if (expandedList === listName) {
      setExpandedList(null);
      setLoadedLeads([]);
    } else {
      setExpandedList(listName);
      const list = savedLists.find((l) => l.name === listName);
      setLoadedLeads(list?.leads || []);
    }
  };

  const handleLoadLeads = (listName: string) => {
    setExpandedList(listName);
    const list = savedLists.find((l) => l.name === listName);
    setLoadedLeads(list?.leads || []);
  };

  const handleDeleteList = async (listName: string) => {
    try {
      await fetch(`${API_BASE}/api/saved-lists/${encodeURIComponent(listName)}`, { method: 'DELETE' });
    } catch {}
    setSavedLists((prev) => prev.filter((l) => l.name !== listName));
    if (expandedList === listName) {
      setExpandedList(null);
      setLoadedLeads([]);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F2F2F7' }}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-5 pt-3 pb-1">
          <div className="ios-card p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #AF52DE, #007AFF)' }}
              >
                <List className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="ios-title truncate">Saved Lists</h2>
                <p className="ios-caption2">
                  {savedLists.length} {savedLists.length === 1 ? 'list' : 'lists'} saved
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-4 sm:px-5 py-2 ios-scroll scrollbar-thin">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center h-48">
              <div className="ios-spinner ios-spinner-lg" />
            </div>
          )}

          {/* Empty State */}
          {!loading && savedLists.length === 0 && (
            <div className="flex items-center justify-center h-full text-center">
              <div className="max-w-md px-4 ios-page-enter">
                <div className="w-[56px] h-[56px] sm:w-[60px] sm:h-[60px] mx-auto mb-5 rounded-[14px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(175,82,222,0.15), rgba(0,122,255,0.1))' }}>
                  <Search className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: '#AF52DE' }} />
                </div>
                <h2 className="text-[20px] font-bold tracking-[-0.3px] mb-1" style={{ color: '#1C1C1E' }}>No saved lists yet</h2>
                <p className="text-[14px] leading-relaxed" style={{ color: '#8E8E93' }}>
                  Search for leads and save them from the <strong style={{ color: '#3A3A3C' }}>Search &amp; Scrape</strong> page.
                </p>
              </div>
            </div>
          )}

          {/* List Cards */}
          {!loading && savedLists.length > 0 && (
            <div className="space-y-3 w-full pb-4">
              {savedLists.map((list) => (
                <div key={list.name} className="ios-page-enter">
                  <div className="ios-card overflow-hidden">
                    {/* Card Header */}
                    <button
                      onClick={() => handleToggleList(list.name)}
                      className="w-full flex items-center justify-between px-4 sm:px-5 py-4 ios-btn-press text-left hover:bg-[#F9F9FB] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0" style={{ backgroundColor: '#E5E5EA', border: '0.5px solid #D1D1D6' }}>
                          <Building2 className="w-4 h-4" style={{ color: '#8E8E93' }} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[14px] font-semibold truncate" style={{ color: '#1C1C1E' }}>{list.name}</h3>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1 text-[12px] whitespace-nowrap" style={{ color: '#8E8E93' }}>
                              <Users className="w-3 h-3" />
                              {list.leadCount} {list.leadCount === 1 ? 'lead' : 'leads'}
                            </span>
                            <span className="flex items-center gap-1 text-[12px] whitespace-nowrap" style={{ color: '#8E8E93' }}>
                              <Calendar className="w-3 h-3" />
                              {formatDate(list.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {expandedList !== list.name && (
                          <>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete "${list.name}" from saved lists?`)) {
                                  handleDeleteList(list.name);
                                }
                              }}
                              className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] ios-btn-press"
                              style={{ color: '#FF3B30' }}
                            >
                              Delete
                            </span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoadLeads(list.name);
                              }}
                              className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] ios-btn-press"
                              style={{ backgroundColor: 'rgba(0,122,255,0.1)', color: '#007AFF' }}
                            >
                              Load Leads
                            </span>
                          </>
                        )}
                        {expandedList === list.name ? (
                          <ChevronDown className="w-4 h-4" style={{ color: '#8E8E93' }} />
                        ) : (
                          <ChevronRight className="w-4 h-4" style={{ color: '#8E8E93' }} />
                        )}
                      </div>
                    </button>

                    {/* Leads Table (expanded) */}
                    {expandedList === list.name && loadedLeads.length > 0 && (
                      <div style={{ borderTop: '0.5px solid #E5E5EA' }}>
                        <div className="overflow-x-auto">
                          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                            <thead>
                              <tr style={{ backgroundColor: '#F9F9FB' }}>
                                <th className="px-3 md:px-4 py-2.5 md:py-3 text-left text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>
                                  Business Name
                                </th>
                                <th className="hidden sm:table-cell px-3 md:px-4 py-2.5 md:py-3 text-left text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>
                                  Address
                                </th>
                                <th className="px-3 md:px-4 py-2.5 md:py-3 text-left text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>
                                  Phone
                                </th>
                                <th className="hidden sm:table-cell px-3 md:px-4 py-2.5 md:py-3 text-left text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>
                                  Website
                                </th>
                                <th className="px-3 md:px-4 py-2.5 md:py-3 text-left text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: '#8E8E93' }}>
                                  Email
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {loadedLeads.map((lead) => (
                                <tr
                                  key={lead.id}
                                  className="transition-colors hover:bg-[#F9F9FB]"
                                  style={{ borderTop: '0.5px solid #E5E5EA' }}
                                >
                                  <td className="px-3 md:px-4 py-2.5 md:py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 md:w-7 md:h-7 rounded-[7px] flex items-center justify-center shrink-0" style={{ backgroundColor: '#E5E5EA', border: '0.5px solid #D1D1D6' }}>
                                        <Building2 className="w-3 h-3 md:w-3.5 md:h-3.5" style={{ color: '#8E8E93' }} />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[12px] md:text-[14px] font-semibold truncate max-w-[140px] md:max-w-[200px]" style={{ color: '#1C1C1E' }}>
                                          {lead.businessName}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="hidden sm:table-cell px-3 md:px-4 py-2.5 md:py-3">
                                    <span className="text-[12px] md:text-[13px] truncate max-w-[140px] md:max-w-[220px] inline-block" style={{ color: '#3A3A3C' }}>
                                      {lead.address || <span style={{ color: '#C7C7CC' }}>-</span>}
                                    </span>
                                  </td>
                                  <td className="px-3 md:px-4 py-2.5 md:py-3">
                                    <span className="text-[12px] md:text-[13px] font-mono" style={{ color: '#3A3A3C' }}>
                                      {lead.phone || <span style={{ color: '#C7C7CC' }}>-</span>}
                                    </span>
                                  </td>
                                  <td className="hidden sm:table-cell px-3 md:px-4 py-2.5 md:py-3">
                                    {lead.website ? (
                                      <a
                                        href={lead.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[12px] md:text-[13px] font-medium hover:underline"
                                        style={{ color: '#007AFF' }}
                                      >
                                        <span className="truncate max-w-[100px] md:max-w-[130px]">
                                          {(() => { try { return new URL(lead.website).hostname; } catch { return lead.website; } })()}
                                        </span>
                                        <ExternalLink className="w-[10px] h-[10px] md:w-[11px] md:h-[11px] shrink-0" />
                                      </a>
                                    ) : (
                                      <span className="text-[12px] md:text-[13px]" style={{ color: '#C7C7CC' }}>-</span>
                                    )}
                                  </td>
                                  <td className="px-3 md:px-4 py-2.5 md:py-3">
                                    <span className="text-[12px] md:text-[13px] font-medium truncate max-w-[120px] md:max-w-[160px] inline-block" style={{ color: '#AF52DE' }}>
                                      {lead.email || <span style={{ color: '#C7C7CC' }}>-</span>}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Table footer */}
                        <div className="px-4 md:px-5 py-2.5 md:py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2" style={{ borderTop: '0.5px solid #E5E5EA', backgroundColor: '#F9F9FB' }}>
                          <p className="text-[12px]" style={{ color: '#8E8E93' }}>
                            Showing {loadedLeads.length} {loadedLeads.length === 1 ? 'lead' : 'leads'}
                          </p>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => {
                                localStorage.setItem('enrich-import-leads', JSON.stringify(loadedLeads));
                                localStorage.setItem('enrich-list-name', list.name);
                                router.push('/enrich');
                              }}
                              className="ios-btn gap-1.5 text-[12px] py-1.5 w-full sm:w-auto"
                              style={{ background: 'linear-gradient(135deg, #AF52DE, #007AFF)' }}
                            >
                              <Sparkles className="w-3 h-3" />
                              Send to Enrich
                            </button>
                            <p className="hidden sm:block text-[12px]" style={{ color: '#8E8E93' }}>
                              Saved {formatDate(list.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
