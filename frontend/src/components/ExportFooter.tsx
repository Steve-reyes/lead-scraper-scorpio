'use client';

import { Download, Save, FileSpreadsheet, ListPlus } from 'lucide-react';

interface ExportFooterProps {
  selectedCount: number;
  totalCount: number;
  onExportCSV: () => void;
  onSaveList: () => void;
}

export default function ExportFooter({
  selectedCount,
  totalCount,
  onExportCSV,
  onSaveList,
}: ExportFooterProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className="sticky bottom-0 left-0 right-0 px-4 sm:px-5 py-3"
      style={{
        backgroundColor: 'rgba(242, 242, 247, 0.95)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderTop: '0.5px solid #E5E5EA',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(0,122,255,0.1)' }}
          >
            <FileSpreadsheet className="w-4 h-4" style={{ color: '#007AFF' }} />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: '#1C1C1E' }}>
              {selectedCount} lead{selectedCount !== 1 ? 's' : ''} selected
            </p>
            <p className="text-[11px]" style={{ color: '#8E8E93' }}>
              {totalCount} total in results
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSaveList}
            className="ios-btn-secondary gap-1.5 text-[13px] h-[36px]"
          >
            <ListPlus className="w-3.5 h-3.5" />
            Save to List
          </button>
          <button
            onClick={onExportCSV}
            className="ios-btn gap-1.5 text-[13px] h-[36px]"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
