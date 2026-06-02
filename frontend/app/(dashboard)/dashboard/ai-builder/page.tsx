import dynamic from 'next/dynamic';

// Force dynamic rendering - prevent static generation
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Dynamic import with no SSR - this is the ONLY way to prevent localStorage errors
const AIBuilderClientPage = dynamic(() => import('./client-page'), {
  ssr: false,
  loading: () => (
    <div className="p-6 flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-[#a1a1a1]">Loading AI Builder...</p>
      </div>
    </div>
  ),
});

export default function AIBuilderPage() {
  return <AIBuilderClientPage />;
}
