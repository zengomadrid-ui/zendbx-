'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'ghost' | 'glass' | 'danger';
type Size    = 'xs' | 'sm' | 'md' | 'lg';

interface SpatialButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant;
  size?:     Size;
  loading?:  boolean;
  icon?:     React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-[#FF7A1A] to-[#FF6B00] border border-[rgba(255,107,0,0.4)] ' +
    'text-white font-semibold ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_4px_16px_rgba(255,107,0,0.3),0_2px_4px_rgba(0,0,0,0.3)] ' +
    'hover:from-[#FF8533] hover:to-[#FF7A1A] ' +
    'hover:shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_8px_24px_rgba(255,107,0,0.45),0_4px_8px_rgba(0,0,0,0.3)] ' +
    'hover:-translate-y-0.5 hover:scale-[1.02] ' +
    'active:translate-y-0 active:scale-[0.99] active:shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_2px_8px_rgba(255,107,0,0.3)]',
  ghost:
    'bg-white/[0.04] border border-white/[0.08] text-white/80 font-medium ' +
    'hover:bg-white/[0.07] hover:border-white/[0.12] hover:text-white hover:-translate-y-0.5 ' +
    'hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] ' +
    'active:translate-y-0 active:bg-white/[0.03]',
  glass:
    'bg-[rgba(17,17,17,0.8)] backdrop-blur-md border border-white/[0.08] text-content-secondary font-medium ' +
    'hover:bg-[rgba(23,23,23,0.9)] hover:border-white/[0.12] hover:text-white hover:-translate-y-0.5 ' +
    'active:translate-y-0',
  danger:
    'bg-gradient-to-b from-red-600 to-red-700 border border-red-500/30 text-white font-semibold ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_4px_16px_rgba(239,68,68,0.2)] ' +
    'hover:from-red-500 hover:to-red-600 hover:-translate-y-0.5 ' +
    'active:translate-y-0',
};

const sizes: Record<Size, string> = {
  xs: 'h-7 px-3 text-xs rounded-lg gap-1.5',
  sm: 'h-8 px-3.5 text-sm rounded-xl gap-2',
  md: 'h-9 px-4 text-sm rounded-xl gap-2',
  lg: 'h-11 px-5 text-base rounded-2xl gap-2.5',
};

const SpatialButton = forwardRef<HTMLButtonElement, SpatialButtonProps>(
  ({ className, variant = 'ghost', size = 'md', loading = false, icon, iconRight, fullWidth = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center',
          'select-none whitespace-nowrap',
          'transition-all duration-200 ease-spring',
          'disabled:opacity-40 disabled:pointer-events-none',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,107,0,0.6)]',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading ? (
          <svg
            className="animate-spin w-4 h-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          icon && <span className="flex-shrink-0 opacity-80">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {iconRight && !loading && (
          <span className="flex-shrink-0 opacity-60">{iconRight}</span>
        )}
      </button>
    );
  }
);

SpatialButton.displayName = 'SpatialButton';
export default SpatialButton;
