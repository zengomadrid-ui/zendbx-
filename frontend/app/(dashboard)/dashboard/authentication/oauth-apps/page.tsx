'use client';

export default function OAuthAppsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-2">OAuth Applications</h1>
      <p className="text-sm text-[#a1a1a1]">Create and manage OAuth 2.0 applications</p>
      
      <div className="mt-6 bg-[#181818] border border-[#2a2a2a] rounded-2xl p-12 text-center">
        <svg className="w-16 h-16 text-[#3a3a3a] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <h3 className="text-lg font-semibold text-white mb-2">OAuth Apps</h3>
        <p className="text-sm text-[#a1a1a1]">Coming soon - Create apps, manage credentials</p>
      </div>
    </div>
  );
}
