'use client';

export default function PoliciesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-2">Access Policies</h1>
      <p className="text-sm text-[#a1a1a1]">Visual policy builder - No SQL required</p>
      
      <div className="mt-6 bg-gradient-to-br from-purple-600/10 to-orange-600/10 border border-purple-600/20 rounded-2xl p-12 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Visual Policy Builder</h3>
        <p className="text-sm text-[#a1a1a1] mb-4">Our unique feature - Build access rules without writing SQL</p>
        <div className="inline-block px-3 py-1 bg-purple-600/20 text-purple-400 text-xs font-semibold rounded-full">
          USP Feature - Coming Soon
        </div>
      </div>
    </div>
  );
}
