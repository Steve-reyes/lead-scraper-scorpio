'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  Sparkles,
  List,
  Settings,
  ChevronLeft,
  ChevronRight,
  Compass,
  BarChart3,
  Columns,
  CheckCircle2,
  Target,
  X,
  Menu,
  LogOut,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onMobileToggle?: () => void;
}

export default function Sidebar({ collapsed, onToggle, onMobileToggle }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const navItems: NavItem[] = [
    { id: 'scrape', label: 'Search & Scrape', icon: Search, path: '/' },
    { id: 'enrich', label: 'Enrich Leads', icon: Sparkles, path: '/enrich' },
    { id: 'enriched', label: 'Enriched Businesses', icon: CheckCircle2, path: '/enriched-businesses' },
    { id: 'lists', label: 'Saved Lists', icon: List, path: '/saved-lists' },
    { id: 'kanban', label: 'Lead Pipeline', icon: Columns, path: '/lead-kanban' },
    { id: 'score', label: 'Lead Score', icon: Target, path: '/lead-score' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  const handleNav = (item: NavItem) => {
    if (item.path !== '#') {
      router.push(item.path);
      setMobileOpen(false);
    }
  };

  const isActive = (item: NavItem): boolean => {
    if (item.path === '#') return false;
    if (item.path === '/') return pathname === '/';
    return pathname === item.path || pathname.startsWith(item.path + '/');
  };

  const handleMobileToggle = () => {
    const next = !mobileOpen;
    setMobileOpen(next);
    onMobileToggle?.();
  };

  const handleSignOut = () => {
    localStorage.removeItem('auth-token');
    window.location.href = '/login';
  };

  const sidebarContent = (
    <div className="flex flex-col h-full ios-sidebar-gradient">
      {/* Logo */}
      <div
        className={`h-[52px] flex items-center border-b shrink-0 ${
          collapsed ? 'justify-center px-0' : 'px-5'
        }`}
        style={{ borderColor: '#38383A' }}
      >
        {collapsed ? (
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: '#007AFF' }}>
            <Compass className="w-4 h-4 text-white" />
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: '#007AFF' }}>
              <Compass className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-white tracking-[-0.3px]">LeadScraper</h1>
              <p className="text-[10px] font-medium" style={{ color: '#8E8E93' }}>Pro</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item)}
              className={`w-full flex items-center gap-3 rounded-[8px] text-[13px] font-medium transition-all duration-150 ios-btn-press ${
                collapsed ? 'justify-center px-2.5 py-2.5' : 'px-3 py-2.5'
              }`}
              style={{
                backgroundColor: active ? '#3A3A3C' : 'transparent',
                color: active ? '#FFFFFF' : '#8E8E93',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = '#2C2C2E';
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`w-[18px] h-[18px] shrink-0`} style={{ color: active ? '#007AFF' : '#8E8E93' }} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t px-2.5 py-3 space-y-0.5 shrink-0" style={{ borderColor: '#38383A' }}>
        <button
          onClick={handleSignOut}
          className={`w-full flex items-center gap-2 rounded-[8px] text-[13px] font-medium transition-all duration-150 ios-btn-press ${
            collapsed ? 'justify-center px-2.5 py-2.5' : 'px-3 py-2.5'
          }`}
          style={{ color: '#8E8E93' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2C2C2E'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          title="Sign out"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>

        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-2 rounded-[8px] text-[13px] font-medium transition-all duration-150 ios-btn-press ${
            collapsed ? 'justify-center px-2.5 py-2.5' : 'px-3 py-2.5'
          }`}
          style={{ color: '#8E8E93' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2C2C2E'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {collapsed ? (
            <ChevronRight className="w-[18px] h-[18px]" />
          ) : (
            <>
              <ChevronLeft className="w-[18px] h-[18px]" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — dark frosted glass */}
      <aside
        className={`${collapsed ? 'w-[60px]' : 'w-[240px]'} flex-col transition-all duration-200 ease-in-out shrink-0 hidden md:flex ios-sidebar`}
        style={{ borderRight: '0.5px solid #38383A' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={handleMobileToggle}
        className="md:hidden fixed top-3 left-3 z-50 w-9 h-9 rounded-[10px] flex items-center justify-center shadow-lg"
        style={{ backgroundColor: '#1C1C1E', border: '0.5px solid #38383A', color: '#8E8E93' }}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={handleMobileToggle}
          />
          <aside
            className="relative w-[280px] max-w-[85vw] ios-sidebar flex flex-col overflow-y-auto"
            style={{ borderRight: '0.5px solid #38383A' }}
          >
            <div className="h-[52px] flex items-center justify-between px-5 border-b shrink-0" style={{ borderColor: '#38383A' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: '#007AFF' }}>
                  <Compass className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-[15px] font-semibold text-white tracking-[-0.3px]">LeadScraper</h1>
                  <p className="text-[10px] font-medium" style={{ color: '#8E8E93' }}>Pro</p>
                </div>
              </div>
              <button
                onClick={handleMobileToggle}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors"
                style={{ color: '#8E8E93' }}
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 py-3 px-2.5 space-y-0.5">
              {navItems.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-medium transition-all duration-150"
                    style={{
                      backgroundColor: active ? '#3A3A3C' : 'transparent',
                      color: active ? '#FFFFFF' : '#8E8E93',
                    }}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" style={{ color: active ? '#007AFF' : '#8E8E93' }} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="border-t px-2.5 py-3" style={{ borderColor: '#38383A' }}>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-[8px] text-[13px] font-medium transition-colors"
                style={{ color: '#8E8E93' }}
              >
                <LogOut className="w-[18px] h-[18px]" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
