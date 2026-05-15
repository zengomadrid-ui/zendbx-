/**
 * Loading Spinner Component
 * Reusable loading indicator
 */

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div
      className={`${sizes[size]} border-orange-500 border-t-transparent rounded-full animate-spin ${className}`}
    />
  );
}

export function LoadingPage({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <p className="text-sm text-[#a1a1a1]">{message}</p>
      </div>
    </div>
  );
}

export function LoadingCard() {
  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6 animate-pulse">
      <div className="h-4 bg-[#2a2a2a] rounded w-3/4 mb-4"></div>
      <div className="h-3 bg-[#2a2a2a] rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-[#2a2a2a] rounded w-2/3"></div>
    </div>
  );
}
