'use client';

import { useState, useEffect } from 'react';

interface SecuritySettings {
  max_login_attempts: number;
  lockout_duration_minutes: number;
  attack_protection_enabled: boolean;
  captcha_enabled: boolean;
  mfa_enabled: boolean;
  mfa_method: string | null;
}

export default function SecurityPage() {
  const [settings, setSettings] = useState<SecuritySettings>({
    max_login_attempts: 5,
    lockout_duration_minutes: 30,
    attack_protection_enabled: true,
    captcha_enabled: false,
    mfa_enabled: false,
    mfa_method: null
  });

  const [showMFASetup, setShowMFASetup] = useState(false);
  const [qrCodeUri, setQrCodeUri] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    // Fetch security settings from API
    // For now, using default values
  };

  const handleSaveSettings = async () => {
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

  const handleEnableMFA = async () => {
    setShowMFASetup(true);
    // Generate QR code
    setQrCodeUri('otpauth://totp/ZENDBX:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ZENDBX');
  };

  const handleVerifyMFA = async () => {
    if (verificationCode.length === 6) {
      // Verify code and enable MFA
      const codes = [
        'A1B2C3D4', 'E5F6G7H8', 'I9J0K1L2',
        'M3N4O5P6', 'Q7R8S9T0', 'U1V2W3X4',
        'Y5Z6A7B8', 'C9D0E1F2', 'G3H4I5J6', 'K7L8M9N0'
      ];
      setBackupCodes(codes);
      setShowBackupCodes(true);
      setSettings({ ...settings, mfa_enabled: true, mfa_method: 'totp' });
    }
  };

  const handleDisableMFA = async () => {
    if (confirm('Are you sure you want to disable MFA? This will make your account less secure.')) {
      setSettings({ ...settings, mfa_enabled: false, mfa_method: null });
      setShowMFASetup(false);
      setShowBackupCodes(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Security Settings</h1>
        <p className="text-sm text-[#a1a1a1] mt-1">
          Configure security and multi-factor authentication
        </p>
      </div>

      {/* Rate Limiting */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-purple-600/10 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Rate Limiting</h2>
            <p className="text-xs text-[#a1a1a1]">Protect against brute force attacks</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white mb-2">
              Max Login Attempts
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="3"
                max="10"
                value={settings.max_login_attempts}
                onChange={(e) => setSettings({ ...settings, max_login_attempts: parseInt(e.target.value) })}
                className="flex-1 h-2 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm font-semibold text-white w-8 text-right">
                {settings.max_login_attempts}
              </span>
            </div>
            <p className="text-xs text-[#6b6b6b] mt-1">
              Number of failed login attempts before account lockout
            </p>
          </div>

          <div>
            <label className="block text-sm text-white mb-2">
              Lockout Duration (minutes)
            </label>
            <input
              type="number"
              min="5"
              max="1440"
              value={settings.lockout_duration_minutes}
              onChange={(e) => setSettings({ ...settings, lockout_duration_minutes: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white focus:outline-none focus:border-purple-600/50"
            />
            <p className="text-xs text-[#6b6b6b] mt-1">
              How long to lock out users after max attempts
            </p>
          </div>
        </div>
      </div>

      {/* Attack Protection */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Attack Protection</h2>
            <p className="text-xs text-[#a1a1a1]">Additional security measures</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#1c1c1c] rounded-lg">
            <div>
              <p className="text-sm font-medium text-white">Attack Protection</p>
              <p className="text-xs text-[#a1a1a1] mt-1">
                Detect and block suspicious login patterns
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, attack_protection_enabled: !settings.attack_protection_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.attack_protection_enabled ? 'bg-purple-600' : 'bg-[#2a2a2a]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.attack_protection_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#1c1c1c] rounded-lg">
            <div>
              <p className="text-sm font-medium text-white">CAPTCHA Verification</p>
              <p className="text-xs text-[#a1a1a1] mt-1">
                Require CAPTCHA after failed login attempts
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, captcha_enabled: !settings.captcha_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.captcha_enabled ? 'bg-purple-600' : 'bg-[#2a2a2a]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.captcha_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Factor Authentication */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-green-600/10 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Multi-Factor Authentication</h2>
            <p className="text-xs text-[#a1a1a1]">Add an extra layer of security</p>
          </div>
        </div>

        {!settings.mfa_enabled ? (
          <div className="space-y-4">
            <div className="p-4 bg-blue-600/10 border border-blue-600/20 rounded-lg">
              <p className="text-sm text-blue-400">
                MFA is currently disabled. Enable it to add an extra layer of security to your account.
              </p>
            </div>

            <button
              onClick={handleEnableMFA}
              className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Enable Multi-Factor Authentication
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-600/10 border border-green-600/20 rounded-lg">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-green-400">
                  MFA is enabled using {settings.mfa_method?.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowBackupCodes(true)}
                className="flex-1 px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg text-sm font-medium transition-colors"
              >
                View Backup Codes
              </button>
              <button
                onClick={handleDisableMFA}
                className="flex-1 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-sm font-medium transition-colors"
              >
                Disable MFA
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-700 hover:to-orange-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* MFA Setup Modal */}
      {showMFASetup && !showBackupCodes && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white mb-2">Set Up MFA</h3>
            <p className="text-sm text-[#a1a1a1] mb-6">
              Scan this QR code with your authenticator app
            </p>

            <div className="bg-white p-4 rounded-lg mb-6">
              <div className="w-48 h-48 mx-auto bg-gray-200 flex items-center justify-center">
                <p className="text-xs text-gray-500 text-center">QR Code<br/>Placeholder</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs text-[#a1a1a1] mb-2">Enter 6-digit code</label>
              <input
                type="text"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-center text-2xl font-mono text-white placeholder-[#6b6b6b] focus:outline-none focus:border-purple-600/50"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowMFASetup(false);
                  setVerificationCode('');
                }}
                className="flex-1 px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyMFA}
                disabled={verificationCode.length !== 6}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Verify & Enable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Codes Modal */}
      {showBackupCodes && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white mb-2">Backup Codes</h3>
            <p className="text-sm text-[#a1a1a1] mb-6">
              Save these codes in a safe place. Each code can only be used once.
            </p>

            <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <div key={index} className="font-mono text-sm text-white bg-[#2a2a2a] px-3 py-2 rounded">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(backupCodes.join('\n'));
                  alert('Backup codes copied to clipboard!');
                }}
                className="flex-1 px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg text-sm font-medium transition-colors"
              >
                Copy Codes
              </button>
              <button
                onClick={() => {
                  setShowBackupCodes(false);
                  setShowMFASetup(false);
                }}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
