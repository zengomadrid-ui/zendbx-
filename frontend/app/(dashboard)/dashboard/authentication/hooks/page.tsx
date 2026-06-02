'use client';


export default function HooksPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-2">Authentication Hooks</h1>
      <p className="text-sm text-[#a1a1a1]">Event-based webhooks for auth events</p>
      
      <div className="mt-6 bg-[#181818] border border-[#2a2a2a] rounded-2xl p-12 text-center">
        <svg className="w-16 h-16 text-[#3a3a3a] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h3 className="text-lg font-semibold text-white mb-2">Auth Hooks</h3>
        <p className="text-sm text-[#a1a1a1]">Coming soon - onSignup, onLogin, onLogout webhooks</p>
      </div>
    </div>
  );
}
