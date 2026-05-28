'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [region, setRegion] = useState('ap-south-1');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showKeys, setShowKeys] = useState(false);
  const [projectKeys, setProjectKeys] = useState<{
    anon_key?: string;
    service_role_key?: string;
    api_url?: string;
  }>({});

  const regions = [
    { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  ];

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setDbPassword(password);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL!}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: projectName,
          description: 'My first project',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create project');
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-600 to-orange-500 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-600/30">
            <span className="text-white font-bold text-3xl">Z</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome to ZENDBX!
          </h1>
          <p className="text-[#a1a1a1] text-lg">
            Let's create your first project and get you started
          </p>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-8">
          <form onSubmit={handleCreateProject} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-[#ededed] mb-2">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                id="projectName"
                type="text"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Todo App, E-commerce Store"
                className="w-full px-4 py-3 bg-[#1c1c1c] border border-[#2a2a2a] text-white placeholder-[#6b6b6b] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <p className="mt-2 text-xs text-[#6b6b6b]">
                This will be used to generate your unique API endpoint
              </p>
            </div>

            <div>
              <label htmlFor="dbPassword" className="block text-sm font-medium text-[#ededed] mb-2">
                Database Password <span className="text-red-500">*</span>
              </label>
              <div className="flex space-x-2">
                <input
                  id="dbPassword"
                  type="text"
                  required
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  placeholder="Enter a strong password"
                  className="flex-1 px-4 py-3 bg-[#1c1c1c] border border-[#2a2a2a] text-white placeholder-[#6b6b6b] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={generatePassword}
                  className="px-4 py-3 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] rounded-lg transition-colors text-sm font-medium"
                >
                  Generate
                </button>
              </div>
              <p className="mt-2 text-xs text-[#6b6b6b]">
                Keep this safe - you'll need it to access your database
              </p>
            </div>

            <div>
              <label htmlFor="region" className="block text-sm font-medium text-[#ededed] mb-2">
                Region <span className="text-red-500">*</span>
              </label>
              <select
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-4 py-3 bg-[#1c1c1c] border border-[#2a2a2a] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {regions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-[#6b6b6b]">
                Choose the region closest to your users for better performance
              </p>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-orange-500 mb-1">What happens next?</p>
                  <ul className="text-xs text-[#a1a1a1] space-y-1">
                    <li>• A dedicated PostgreSQL database will be created for your project</li>
                    <li>• You'll get a unique API endpoint to access your data</li>
                    <li>• You can start building immediately with full CRUD operations</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !projectName || !dbPassword}
              className="w-full py-3 px-4 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-600/30"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating your instant backend...
                </span>
              ) : (
                'Create Project & Get Started'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#6b6b6b] mt-6">
          By creating a project, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
