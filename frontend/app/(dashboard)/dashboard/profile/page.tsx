'use client';

// Prevent static generation - this page needs client-side rendering
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  plan: string;
  created_at: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setUser(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl">
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-12 text-center">
          <p className="text-xs text-[#a1a1a1]">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6 max-w-4xl">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-xs text-red-500">{error || 'Failed to load profile'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#ededed]">Profile</h1>
        <p className="text-xs text-[#a1a1a1] mt-1">Manage your account settings</p>
      </div>

      {/* Profile Card */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6">
        <div className="flex items-start space-x-4">
          {/* Avatar */}
          <div className="w-20 h-20 bg-gradient-to-br from-orange-600 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-white">
              {user.full_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* User Info */}
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-[#ededed]">{user.full_name || 'User'}</h2>
            <p className="text-sm text-[#a1a1a1] mt-1">{user.email}</p>
            
            <div className="flex items-center space-x-3 mt-4">
              <span className={`px-3 py-1 rounded text-xs font-medium ${
                user.role === 'admin'
                  ? 'bg-orange-500/10 text-orange-500'
                  : 'bg-blue-500/10 text-blue-500'
              }`}>
                {user.role === 'admin' ? 'Admin' : 'User'}
              </span>
              <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded text-xs font-medium">
                {user.plan === 'free' ? 'Free Plan' : user.plan.charAt(0).toUpperCase() + user.plan.slice(1) + ' Plan'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6">
        <h3 className="text-sm font-semibold text-[#ededed] mb-4">Account Details</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#a1a1a1] mb-1">User ID</label>
            <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded px-3 py-2">
              <code className="text-xs text-[#ededed] font-mono">{user.id}</code>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#a1a1a1] mb-1">Email Address</label>
            <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded px-3 py-2">
              <p className="text-xs text-[#ededed]">{user.email}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#a1a1a1] mb-1">Member Since</label>
            <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded px-3 py-2">
              <p className="text-xs text-[#ededed]">{formatDate(user.created_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6">
        <h3 className="text-sm font-semibold text-[#ededed] mb-4">Security</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-[#1c1c1c] border border-[#2a2a2a] rounded">
            <div>
              <p className="text-xs font-medium text-[#ededed]">Password</p>
              <p className="text-xs text-[#6b6b6b] mt-0.5">Last changed recently</p>
            </div>
            <button className="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] rounded text-xs font-medium transition-colors">
              Change Password
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#1c1c1c] border border-[#2a2a2a] rounded">
            <div>
              <p className="text-xs font-medium text-[#ededed]">Two-Factor Authentication</p>
              <p className="text-xs text-[#6b6b6b] mt-0.5">Add an extra layer of security</p>
            </div>
            <button className="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] rounded text-xs font-medium transition-colors">
              Enable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
