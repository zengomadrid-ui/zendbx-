'use client';


import { useState } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    jwt_expiry_minutes: 60,
    refresh_token_expiry_days: 30,
    session_timeout_minutes: 1440,
    password_min_length: 8,
    password_require_uppercase: true,
    password_require_lowercase: true,
    password_require_numbers: true,
    password_require_special: true,
    email_verification_required: true,
    welcome_email_enabled: true,
    password_reset_email_enabled: true
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save settings to API
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Authentication Settings</h1>
        <p className="text-sm text-[#a1a1a1] mt-1">
          Configure general authentication and session settings
        </p>
      </div>

      {/* Token Settings */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-purple-600/10 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Token & Session</h2>
            <p className="text-xs text-[#a1a1a1]">Configure token expiry and session timeouts</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white mb-2">
              JWT Expiry (minutes)
            </label>
            <input
              type="number"
              min="5"
              max="1440"
              value={settings.jwt_expiry_minutes}
              onChange={(e) => setSettings({ ...settings, jwt_expiry_minutes: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white focus:outline-none focus:border-purple-600/50"
            />
            <p className="text-xs text-[#6b6b6b] mt-1">
              How long JWT tokens remain valid (default: 60 minutes)
            </p>
          </div>

          <div>
            <label className="block text-sm text-white mb-2">
              Refresh Token Expiry (days)
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={settings.refresh_token_expiry_days}
              onChange={(e) => setSettings({ ...settings, refresh_token_expiry_days: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white focus:outline-none focus:border-purple-600/50"
            />
            <p className="text-xs text-[#6b6b6b] mt-1">
              How long refresh tokens remain valid (default: 30 days)
            </p>
          </div>

          <div>
            <label className="block text-sm text-white mb-2">
              Session Timeout (minutes)
            </label>
            <input
              type="number"
              min="30"
              max="10080"
              value={settings.session_timeout_minutes}
              onChange={(e) => setSettings({ ...settings, session_timeout_minutes: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white focus:outline-none focus:border-purple-600/50"
            />
            <p className="text-xs text-[#6b6b6b] mt-1">
              Inactive session timeout (default: 1440 minutes / 24 hours)
            </p>
          </div>
        </div>
      </div>

      {/* Password Policy */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Password Policy</h2>
            <p className="text-xs text-[#a1a1a1]">Set password requirements for users</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white mb-2">
              Minimum Password Length
            </label>
            <input
              type="number"
              min="6"
              max="32"
              value={settings.password_min_length}
              onChange={(e) => setSettings({ ...settings, password_min_length: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white focus:outline-none focus:border-purple-600/50"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-[#1c1c1c] rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">Require Uppercase Letters</p>
                <p className="text-xs text-[#a1a1a1] mt-1">At least one uppercase letter (A-Z)</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, password_require_uppercase: !settings.password_require_uppercase })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.password_require_uppercase ? 'bg-purple-600' : 'bg-[#2a2a2a]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.password_require_uppercase ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-[#1c1c1c] rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">Require Lowercase Letters</p>
                <p className="text-xs text-[#a1a1a1] mt-1">At least one lowercase letter (a-z)</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, password_require_lowercase: !settings.password_require_lowercase })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.password_require_lowercase ? 'bg-purple-600' : 'bg-[#2a2a2a]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.password_require_lowercase ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-[#1c1c1c] rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">Require Numbers</p>
                <p className="text-xs text-[#a1a1a1] mt-1">At least one number (0-9)</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, password_require_numbers: !settings.password_require_numbers })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.password_require_numbers ? 'bg-purple-600' : 'bg-[#2a2a2a]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.password_require_numbers ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-[#1c1c1c] rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">Require Special Characters</p>
                <p className="text-xs text-[#a1a1a1] mt-1">At least one special character (!@#$%^&*)</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, password_require_special: !settings.password_require_special })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.password_require_special ? 'bg-purple-600' : 'bg-[#2a2a2a]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.password_require_special ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Email Settings */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-green-600/10 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Email Notifications</h2>
            <p className="text-xs text-[#a1a1a1]">Configure email templates and notifications</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-[#1c1c1c] rounded-lg">
            <div>
              <p className="text-sm font-medium text-white">Email Verification Required</p>
              <p className="text-xs text-[#a1a1a1] mt-1">Users must verify email before accessing account</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, email_verification_required: !settings.email_verification_required })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.email_verification_required ? 'bg-purple-600' : 'bg-[#2a2a2a]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.email_verification_required ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#1c1c1c] rounded-lg">
            <div>
              <p className="text-sm font-medium text-white">Welcome Email</p>
              <p className="text-xs text-[#a1a1a1] mt-1">Send welcome email to new users</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, welcome_email_enabled: !settings.welcome_email_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.welcome_email_enabled ? 'bg-purple-600' : 'bg-[#2a2a2a]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.welcome_email_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#1c1c1c] rounded-lg">
            <div>
              <p className="text-sm font-medium text-white">Password Reset Email</p>
              <p className="text-xs text-[#a1a1a1] mt-1">Send email for password reset requests</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, password_reset_email_enabled: !settings.password_reset_email_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.password_reset_email_enabled ? 'bg-purple-600' : 'bg-[#2a2a2a]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.password_reset_email_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-700 hover:to-orange-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
