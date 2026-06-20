'use client';

import { apiFetch, getApiUrl } from '@/lib/fetch-utils';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Plan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  api_requests_limit: number;
  database_size_limit: number;
  projects_limit: number;
  team_members_limit: number;
  backup_frequency: string;
  features: string[];
}

interface Usage {
  api_requests_count: number;
  database_size_bytes: number;
  projects_count: number;
  team_members_count: number;
  period_start: string;
  period_end: string;
}

interface Subscription {
  plan: Plan;
  usage: Usage;
  status: string;
}

export default function BillingPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No auth token found');
        setLoading(false);
        return;
      }
      
      // Fetch current subscription and usage
      const subRes = await apiFetch(`api/billing/subscription`);
      
      if (!subRes.ok) {
        console.error('Failed to fetch subscription:', subRes.status);
        setLoading(false);
        return;
      }
      
      const subData = await subRes.json();
      console.log('Subscription data:', subData);
      setSubscription(subData);

      // Fetch available plans
      const plansRes = await apiFetch(`api/billing/plans`);
      
      if (!plansRes.ok) {
        console.error('Failed to fetch plans:', plansRes.status);
      } else {
        const plansData = await plansRes.json();
        console.log('Plans data:', plansData);
        setPlans(plansData);
      }
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowUpgradeModal(true);
  };

  const confirmUpgrade = async () => {
    if (!selectedPlan) return;

    try {
      const token = localStorage.getItem('token');
      const res = await apiFetch(`api/billing/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan_id: selectedPlan.id })
      });

      if (res.ok) {
        alert('Plan upgraded successfully!');
        setShowUpgradeModal(false);
        fetchBillingData();
      } else {
        const error = await res.json();
        alert(error.detail || 'Failed to upgrade plan');
      }
    } catch (error) {
      console.error('Failed to upgrade:', error);
      alert('Failed to upgrade plan');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getUsagePercentage = (current: number, limit: number) => {
    if (limit === 999999999) return 0; // Unlimited
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="text-white">Loading billing information...</div>
      </div>
    );
  }

  if (!subscription || !subscription.plan || !subscription.usage) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="text-center">
          <div className="text-white text-xl mb-4">No billing information available</div>
          <p className="text-gray-400 mb-4">Please make sure the backend is running and the database is set up.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { plan, usage } = subscription;

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Billing & Usage</h1>
          <p className="text-gray-400 mt-2">Manage your subscription and monitor usage</p>
        </div>

        {/* Current Plan Card */}
        <div className="bg-zinc-800 rounded-lg p-6 mb-8 border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-orange-500">{plan.display_name}</h2>
              <p className="text-gray-400 mt-1">
                {plan.price_monthly === 0 ? 'Free Forever' : `$${plan.price_monthly}/month`}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Billing period: {new Date(usage.period_start).toLocaleDateString()} - {new Date(usage.period_end).toLocaleDateString()}
              </p>
            </div>
            {plan.name !== 'business' && (
              <button
                onClick={() => {
                  const nextPlan = plans.find(p => 
                    (plan.name === 'free' && p.name === 'pro') ||
                    (plan.name === 'pro' && p.name === 'business')
                  );
                  if (nextPlan) handleUpgrade(nextPlan);
                }}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold"
              >
                Upgrade Plan
              </button>
            )}
          </div>
        </div>

        {/* Usage Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* API Requests */}
          <div className="bg-zinc-800 rounded-lg p-6 border border-gray-700">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">API Requests</h3>
                <p className="text-sm text-gray-400">This month</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{formatNumber(usage.api_requests_count)}</p>
                <p className="text-sm text-gray-400">
                  of {plan.api_requests_limit === 999999999 ? 'Unlimited' : formatNumber(plan.api_requests_limit)}
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${getUsageColor(getUsagePercentage(usage.api_requests_count, plan.api_requests_limit))}`}
                style={{ width: `${getUsagePercentage(usage.api_requests_count, plan.api_requests_limit)}%` }}
              />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              {getUsagePercentage(usage.api_requests_count, plan.api_requests_limit).toFixed(1)}% used
            </p>
          </div>

          {/* Database Size */}
          <div className="bg-zinc-800 rounded-lg p-6 border border-gray-700">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">Database Size</h3>
                <p className="text-sm text-gray-400">Total storage</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{formatBytes(usage.database_size_bytes)}</p>
                <p className="text-sm text-gray-400">
                  of {plan.database_size_limit === 999999999999 ? 'Unlimited' : formatBytes(plan.database_size_limit)}
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${getUsageColor(getUsagePercentage(usage.database_size_bytes, plan.database_size_limit))}`}
                style={{ width: `${getUsagePercentage(usage.database_size_bytes, plan.database_size_limit)}%` }}
              />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              {getUsagePercentage(usage.database_size_bytes, plan.database_size_limit).toFixed(1)}% used
            </p>
          </div>

          {/* Projects */}
          <div className="bg-zinc-800 rounded-lg p-6 border border-gray-700">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">Projects</h3>
                <p className="text-sm text-gray-400">Active projects</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{usage.projects_count}</p>
                <p className="text-sm text-gray-400">
                  of {plan.projects_limit === 999 ? 'Unlimited' : plan.projects_limit}
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${getUsageColor(getUsagePercentage(usage.projects_count, plan.projects_limit))}`}
                style={{ width: `${getUsagePercentage(usage.projects_count, plan.projects_limit)}%` }}
              />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              {getUsagePercentage(usage.projects_count, plan.projects_limit).toFixed(1)}% used
            </p>
          </div>

          {/* Team Members */}
          <div className="bg-zinc-800 rounded-lg p-6 border border-gray-700">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">Team Members</h3>
                <p className="text-sm text-gray-400">Across all projects</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{usage.team_members_count}</p>
                <p className="text-sm text-gray-400">
                  of {plan.team_members_limit === 999 ? 'Unlimited' : plan.team_members_limit}
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${getUsageColor(getUsagePercentage(usage.team_members_count, plan.team_members_limit))}`}
                style={{ width: `${getUsagePercentage(usage.team_members_count, plan.team_members_limit)}%` }}
              />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              {getUsagePercentage(usage.team_members_count, plan.team_members_limit).toFixed(1)}% used
            </p>
          </div>
        </div>

        {/* Plan Comparison */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Available Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => (
              <div
                key={p.id}
                className={`bg-zinc-800 rounded-lg p-6 border-2 ${
                  p.id === plan.id ? 'border-orange-500' : 'border-gray-700'
                }`}
              >
                <div className="mb-4">
                  <h3 className="text-xl font-bold">{p.display_name}</h3>
                  <p className="text-3xl font-bold text-orange-500 mt-2">
                    {p.price_monthly === 0 ? 'Free' : `$${p.price_monthly}`}
                    {p.price_monthly > 0 && <span className="text-sm text-gray-400">/month</span>}
                  </p>
                </div>

                <ul className="space-y-3 mb-6">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">
                      {p.api_requests_limit === 999999999 ? 'Unlimited' : formatNumber(p.api_requests_limit)} API requests/month
                    </span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">
                      {p.database_size_limit === 999999999999 ? 'Unlimited' : formatBytes(p.database_size_limit)} database storage
                    </span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">
                      {p.projects_limit === 999 ? 'Unlimited' : p.projects_limit} {p.projects_limit === 1 ? 'project' : 'projects'}
                    </span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">
                      {p.team_members_limit === 999 ? 'Unlimited' : p.team_members_limit} team {p.team_members_limit === 1 ? 'member' : 'members'}
                    </span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm capitalize">{p.backup_frequency} backups</span>
                  </li>
                </ul>

                {p.id === plan.id ? (
                  <button
                    disabled
                    className="w-full py-2 bg-gray-700 text-gray-400 rounded-lg font-semibold cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : p.price_monthly > plan.price_monthly ? (
                  <button
                    onClick={() => handleUpgrade(p)}
                    className="w-full py-2 bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold"
                  >
                    Upgrade to {p.display_name}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-2 bg-gray-700 text-gray-400 rounded-lg font-semibold cursor-not-allowed"
                  >
                    Downgrade (Contact Support)
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade Modal */}
        {showUpgradeModal && selectedPlan && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-zinc-800 rounded-lg p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-4">Upgrade to {selectedPlan.display_name}?</h2>
              <p className="text-gray-400 mb-6">
                You'll be charged ${selectedPlan.price_monthly}/month starting today. Your new limits will be available immediately.
              </p>
              
              <div className="bg-zinc-900 rounded-lg p-4 mb-6">
                <h3 className="font-semibold mb-2">New Limits:</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• {formatNumber(selectedPlan.api_requests_limit)} API requests/month</li>
                  <li>• {formatBytes(selectedPlan.database_size_limit)} database storage</li>
                  <li>• {selectedPlan.projects_limit} projects</li>
                  <li>• {selectedPlan.team_members_limit} team members</li>
                  <li>• {selectedPlan.backup_frequency} backups</li>
                </ul>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUpgrade}
                  className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold"
                >
                  Confirm Upgrade
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
