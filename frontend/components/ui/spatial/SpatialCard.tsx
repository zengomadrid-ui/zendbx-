'use client';

import { forwardRef, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface SpatialCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  tiltOnHover?: boolean;
  elevated?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  as?: 'div' | 'article' | 'section';
}

const paddingMap = {
  none: '',
  sm:   'p-4',
  md:   'p-5',
  lg:   'p-6',
};

/**
 * SpatialCard — a floating surface with optional 3D tilt and glow on hover.
 * Max tilt: 3deg per the design spec.
 */
const SpatialCard = forwardRef<HTMLDivElement, SpatialCardProps>(
  ({ className, glow = false, tiltOnHover = true, elevated = false, padding = 'md', as: Tag = 'div', children, onMouseMove, onMouseLeave, style, ...props }, ref) => {
    const innerRef = useRef<HTMLDivElement>(null);
    const combinedRef = (node: HTMLDivElement) => {
      innerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    };

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      onMouseMove?.(e);
      if (!tiltOnHover || !innerRef.current) return;
      const rect = innerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      // Max 3deg tilt as per design spec
      const rotX = (-dy * 3).toFixed(2);
      const rotY = (dx * 3).toFixed(2);
      innerRef.current.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-2px) scale(1.005)`;
    }, [tiltOnHover, onMouseMove]);

    const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      onMouseLeave?.(e);
      if (!innerRef.current) return;
      innerRef.current.style.transform = '';
    }, [onMouseLeave]);

    return (
      <Tag
        ref={combinedRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={style}
        className={cn(
          'relative rounded-2xl overflow-hidden',
          elevated
            ? 'bg-[rgba(23,23,23,0.9)] border border-white/[0.07]'
            : 'bg-[rgba(17,17,17,0.85)] border border-white/[0.06]',
          'shadow-spatial-3',
          'transition-[box-shadow,border-color] duration-250 ease-spring',
          'hover:border-white/[0.1]',
          glow && 'hover:shadow-card-hover',
          paddingMap[padding],
          className,
        )}
        {...props}
      >
        {/* Top edge highlight — simulates ambient light from above */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
        />
        {children}
      </Tag>
    );
  }
);

SpatialCard.displayName = 'SpatialCard';
export default SpatialCard;
