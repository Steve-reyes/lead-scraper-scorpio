'use client';

import { useState, FormEvent, useRef } from 'react';
import { Search, MapPin, Globe, Navigation, Loader2 } from 'lucide-react';

interface TopBarProps {
  onSearch: (keyword: string, location: string, country: string, radiusKm: number) => void;
  isSearching: boolean;
  onClear?: () => void;
  leadsCount?: number;
}

export default function TopBar({ onSearch, isSearching, onClear, leadsCount }: TopBarProps) {
  const [keyword, setKeyword] = useState('Dentist');
  const [location, setLocation] = useState('Austin, TX');
  const [country, setCountry] = useState('United States');
  const [radiusKm, setRadiusKm] = useState(0);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const searchRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !location.trim() || isSearching) return;
    onSearch(keyword.trim(), location.trim(), country, radiusKm);
  };

  return (
    <div className="px-4 sm:px-5 pt-3 pb-2" style={{ backgroundColor: '#F2F2F7' }}>
      <form
        ref={searchRef}
        onSubmit={handleSubmit}
        className="ios-card p-3 sm:p-4"
      >
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5 items-stretch sm:items-center">
          {/* Keyword Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-[15px] h-[15px]" style={{ color: '#8E8E93' }} />
            </div>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onFocus={() => setFocusedField('keyword')}
              onBlur={() => setFocusedField(null)}
              placeholder="e.g., Dentist, Plumber, Restaurant"
              className="ios-input pl-9 text-[14px]"
              style={{
                borderColor: focusedField === 'keyword' ? '#007AFF' : 'transparent',
                boxShadow: focusedField === 'keyword' ? '0 0 0 3px rgba(0,122,255,0.15)' : 'none',
              }}
              disabled={isSearching}
            />
          </div>

          {/* Location Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MapPin className="w-[15px] h-[15px]" style={{ color: '#8E8E93' }} />
            </div>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onFocus={() => setFocusedField('location')}
              onBlur={() => setFocusedField(null)}
              placeholder="e.g., Austin, TX or 123 Main St"
              title="Use a street address for radius targeting"
              className="ios-input pl-9 text-[14px]"
              style={{
                borderColor: focusedField === 'location' ? '#007AFF' : 'transparent',
                boxShadow: focusedField === 'location' ? '0 0 0 3px rgba(0,122,255,0.15)' : 'none',
              }}
              disabled={isSearching}
            />
          </div>

          {/* Radius + Country row */}
          <div className="flex gap-2 flex-1 sm:flex-initial">
            {/* Radius */}
            <div className="relative flex-1 sm:w-[90px] sm:flex-none">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <Navigation className="w-[15px] h-[15px]" style={{ color: '#8E8E93' }} />
              </div>
              <input
                type="number"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                onFocus={() => setFocusedField('radius')}
                onBlur={() => setFocusedField(null)}
                placeholder="Km"
                min={0}
                max={50}
                step={5}
                className="ios-input pl-8 text-[14px]"
                style={{
                  borderColor: focusedField === 'radius' ? '#007AFF' : 'transparent',
                  boxShadow: focusedField === 'radius' ? '0 0 0 3px rgba(0,122,255,0.15)' : 'none',
                }}
                disabled={isSearching}
              />
              {radiusKm > 0 && (
                <p className="text-[10px] mt-1 leading-tight px-0.5" style={{ color: '#8E8E93' }}>
                  Use street address above
                </p>
              )}
            </div>

            {/* Country */}
            <div className="relative flex-1 sm:max-w-[140px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Globe className="w-[15px] h-[15px]" style={{ color: '#8E8E93' }} />
              </div>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                onFocus={() => setFocusedField('country')}
                onBlur={() => setFocusedField(null)}
                placeholder="Country"
                className="ios-input pl-9 text-[14px]"
                style={{
                  borderColor: focusedField === 'country' ? '#007AFF' : 'transparent',
                  boxShadow: focusedField === 'country' ? '0 0 0 3px rgba(0,122,255,0.15)' : 'none',
                }}
                disabled={isSearching}
              />
            </div>
          </div>

          {/* Find Leads Button */}
          <button
            type="submit"
            disabled={isSearching || !keyword.trim() || !location.trim()}
            className="ios-btn shrink-0 gap-2 text-[14px] h-[40px] min-w-[120px]"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Find Leads
              </>
            )}
          </button>

          {/* Clear All Button — beside Find Leads */}
          {onClear && leadsCount !== undefined && leadsCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="ios-btn-secondary shrink-0 gap-1.5 text-[13px] h-[40px] px-3"
              style={{ color: '#FF3B30', borderColor: 'rgba(255,59,48,0.3)' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear ({leadsCount})
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
