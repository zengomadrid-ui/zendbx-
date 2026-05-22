/**
 * Loading Spinner Component
 * Reusable loading indicator with logo
 */
import Image from 'next/image';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  return (
    <div className={`${sizes[size]} relative ${className}`}>
      <Image
        src="/AURIX - 3.png"
        alt="Loading"
        width={96}
        height={96}
        className="w-full h-full object-contain animate-pulse"
        priority
      />
    </div>
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
