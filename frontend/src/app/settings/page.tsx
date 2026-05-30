'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { Settings as SettingsIcon, Key, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [storedPw, setStoredPw] = useState('');

  useEffect(() => {
    const pw = localStorage.getItem('app-password') || 'leadscraper2024';
    setStoredPw(pw);
  }, []);

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (currentPassword !== storedPw) {
      setMessage({ type: 'error', text: 'Current password is incorrect.' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    localStorage.setItem('app-password', newPassword);
    // Update the stored auth-token to the new password so user stays logged in
    localStorage.setItem('auth-token', newPassword);
    setStoredPw(newPassword);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage({ type: 'success', text: 'Password changed successfully!' });
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#F2F2F7' }}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto ios-scroll scrollbar-thin">
        <div className="px-4 sm:px-5 pt-3 pb-1">
          <div className="ios-card p-4">
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" style={{ color: '#007AFF' }} />
              <h1 className="ios-title">Settings</h1>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-2 max-w-lg space-y-4 pb-6">
          {/* Change Password */}
          <div className="ios-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <Key className="w-[18px] h-[18px]" style={{ color: '#007AFF' }} />
              <h2 className="text-[15px] font-semibold" style={{ color: '#1C1C1E' }}>Change Password</h2>
            </div>

            {message && (
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-[10px] text-[13px] font-medium mb-4 border"
                style={{
                  backgroundColor: message.type === 'success' ? '#F0FFF0' : '#FFF2F2',
                  color: message.type === 'success' ? '#34C759' : '#FF3B30',
                  borderColor: message.type === 'success' ? 'rgba(52,199,89,0.2)' : 'rgba(255,59,48,0.2)',
                }}
              >
                {message.type === 'success' ? <CheckCircle2 className="w-[18px] h-[18px] shrink-0" /> : <AlertCircle className="w-[18px] h-[18px] shrink-0" />}
                {message.text}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium mb-1" style={{ color: '#3A3A3C' }}>Current Password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="ios-input text-[14px]"
                  required
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium mb-1" style={{ color: '#3A3A3C' }}>New Password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="ios-input text-[14px]"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium mb-1" style={{ color: '#3A3A3C' }}>Confirm New Password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="ios-input text-[14px]"
                  required
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  className="ios-toggle"
                  data-checked={showPw}
                  onClick={() => setShowPw(!showPw)}
                  style={{ backgroundColor: showPw ? '#34C759' : '#C7C7CC' }}
                >
                  <span className="ios-toggle-thumb" />
                </div>
                <span className="text-[13px]" style={{ color: '#8E8E93' }}>Show passwords</span>
              </label>

              <button
                type="submit"
                className="ios-btn text-[14px]"
              >
                Change Password
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
