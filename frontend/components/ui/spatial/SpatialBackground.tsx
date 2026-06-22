'use client';

import { useEffect, useRef } from 'react';

/**
 * SpatialBackground — the deepest layer.
 * Dark ambient gradient + animated glow orbs + subtle noise texture.
 * Mouse-tracked radial highlight on the main orb.
 */
export default function SpatialBackground() {
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number;
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let currentX = mouseX;
    let currentY = mouseY;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const tick = () => {
      if (orbRef.current) {
        // Lerp for smooth parallax follow
        currentX += (mouseX - currentX) * 0.04;
        currentY += (mouseY - currentY) * 0.04;
        const px = (currentX / window.innerWidth) * 100;
        const py = (currentY / window.innerHeight) * 100;
        orbRef.current.style.background =
          `radial-gradient(ellipse 800px 600px at ${px}% ${py}%, rgba(255,107,0,0.055) 0%, transparent 70%)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    rafId = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div aria-hidden className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-[#050505]" />

      {/* Depth gradient — gives the sense of depth receding into background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,107,0,0.04)_0%,transparent_60%)]" />

      {/* Bottom vignette */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />

      {/* Ambient orb — top left */}
      <div
        className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full opacity-[0.04]"
        style={{
          background: 'radial-gradient(circle, #FF6B00 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'ambientDrift 25s ease-in-out infinite',
        }}
      />

      {/* Ambient orb — bottom right */}
      <div
        className="absolute -bottom-60 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.03]"
        style={{
          background: 'radial-gradient(circle, #FF6B00 0%, transparent 70%)',
          filter: 'blur(100px)',
          animation: 'ambientDrift 30s ease-in-out infinite reverse',
          animationDelay: '-10s',
        }}
      />

      {/* Mouse-tracked dynamic highlight */}
      <div ref={orbRef} className="absolute inset-0 transition-none" />

      {/* Very subtle noise grain */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />
    </div>
  );
}
