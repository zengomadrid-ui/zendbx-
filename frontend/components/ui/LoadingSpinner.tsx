'use client';

import Image from 'next/image';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  className?: string;
}

const sizeMap = {
  sm:  { logo: 32,  wrapper: 'w-8 h-8',   glow: 'w-14 h-14',   text: 'text-sm' },
  md:  { logo: 48,  wrapper: 'w-12 h-12',  glow: 'w-20 h-20',   text: 'text-base' },
  lg:  { logo: 64,  wrapper: 'w-16 h-16',  glow: 'w-28 h-28',   text: 'text-lg' },
  xl:  { logo: 96,  wrapper: 'w-24 h-24',  glow: 'w-40 h-40',   text: 'text-xl' },
};

export default function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
  const s = sizeMap[size];

  return (
    <div className={`flex flex-col items-center justify-center gap-5 ${className}`}>
      {/* Logo + glow stack */}
      <div className="relative flex items-center justify-center">
        {/* Outer ambient glow — static, just pulses */}
        <div
          className={`absolute ${s.glow} rounded-full bg-orange-500/20 blur-2xl animate-pulse`}
          aria-hidden
        />

        {/* Spinning logo */}
        <div
          className={`relative ${s.wrapper} animate-spin`}
          style={{ animationDuration: '2.4s', animationTimingFunction: 'linear' }}
        >
          <Image
            src="/AURIX-3.png"
            alt="Loading"
            width={s.logo}
            height={s.logo}
            priority
            className="w-full h-full rounded-full"
            style={{
              filter:
                'drop-shadow(0 0 12px rgba(251,146,60,0.9)) drop-shadow(0 0 28px rgba(251,146,60,0.5)) brightness(1.15)',
            }}
          />
        </div>

        {/* Counter-rotating orange ring */}
        <div
          className={`absolute ${s.wrapper} rounded-full border-2 border-transparent animate-spin`}
          style={{
            animationDuration: '1.6s',
            animationDirection: 'reverse',
            animationTimingFunction: 'linear',
            borderTopColor: 'rgba(251,146,60,0.7)',
            borderRightColor: 'rgba(251,146,60,0.2)',
          }}
          aria-hidden
        />
      </div>

      {/* Text */}
      {text && (
        <p className={`${s.text} font-medium text-white/80 animate-pulse tracking-wide`}>
          {text}
        </p>
      )}
    </div>
  );
}

export function LoadingSpinnerInline({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const s = sizeMap[size];
  return (
    <div className="relative flex items-center justify-center">
      <div className={`absolute ${s.glow} rounded-full bg-orange-500/20 blur-xl animate-pulse`} aria-hidden />
      <div
        className={`relative ${s.wrapper} animate-spin`}
        style={{ animationDuration: '2.4s', animationTimingFunction: 'linear' }}
      >
        <Image
          src="/AURIX-3.png"
          alt="Loading"
          width={s.logo}
          height={s.logo}
          priority
          className="w-full h-full rounded-full"
          style={{
            filter: 'drop-shadow(0 0 8px rgba(251,146,60,0.8)) brightness(1.1)',
          }}
        />
      </div>
    </div>
  );
}
