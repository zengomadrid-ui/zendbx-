import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Spatial background layers */
        space: {
          bg:      '#050505',
          surface: '#111111',
          card:    '#171717',
          elevated:'#1e1e1e',
          border:  'rgba(255,255,255,0.06)',
          'border-hover': 'rgba(255,255,255,0.1)',
        },
        /* Brand accent */
        accent: {
          DEFAULT: '#FF6B00',
          dim:     'rgba(255,107,0,0.35)',
          subtle:  'rgba(255,107,0,0.08)',
          border:  'rgba(255,107,0,0.2)',
          bright:  '#ff8533',
        },
        /* Glass surface tokens */
        glass: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          hover:   'rgba(255,255,255,0.09)',
          active:  'rgba(255,255,255,0.04)',
        },
        /* Text hierarchy */
        content: {
          primary:   '#FFFFFF',
          secondary: '#A1A1AA',
          tertiary:  '#71717A',
          disabled:  '#52525B',
        },
        /* Status */
        success: { DEFAULT: '#22c55e', dim: 'rgba(34,197,94,0.15)' },
        warning: { DEFAULT: '#f59e0b', dim: 'rgba(245,158,11,0.15)' },
        error:   { DEFAULT: '#ef4444', dim: 'rgba(239,68,68,0.15)' },
        info:    { DEFAULT: '#3b82f6', dim: 'rgba(59,130,246,0.15)' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.05em' }],
        xs:    ['12px', { lineHeight: '16px' }],
        sm:    ['13px', { lineHeight: '20px' }],
        base:  ['14px', { lineHeight: '22px' }],
        md:    ['15px', { lineHeight: '24px' }],
        lg:    ['16px', { lineHeight: '26px' }],
        xl:    ['18px', { lineHeight: '28px' }],
        '2xl': ['22px', { lineHeight: '32px' }],
        '3xl': ['28px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '44px' }],
        '5xl': ['48px', { lineHeight: '56px' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '72': '18rem',
        '84': '21rem',
        '88': '22rem',
        '280': '280px',
        '80':  '80px',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      backdropBlur: {
        xs:  '4px',
        sm:  '8px',
        md:  '16px',
        lg:  '24px',
        xl:  '40px',
        '2xl':'60px',
      },
      boxShadow: {
        /* Spatial elevation system */
        'spatial-1': '0 2px 8px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.2)',
        'spatial-2': '0 4px 16px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.04) inset',
        'spatial-3': '0 8px 32px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05) inset',
        'spatial-4': '0 16px 64px rgba(0,0,0,0.7), 0 8px 16px rgba(0,0,0,0.5)',
        'spatial-5': '0 32px 128px rgba(0,0,0,0.8), 0 16px 32px rgba(0,0,0,0.6)',
        /* Orange glow */
        'glow-sm': '0 0 12px rgba(255,107,0,0.25), 0 0 4px rgba(255,107,0,0.15)',
        'glow-md': '0 0 24px rgba(255,107,0,0.35), 0 0 8px rgba(255,107,0,0.2)',
        'glow-lg': '0 0 48px rgba(255,107,0,0.4), 0 0 16px rgba(255,107,0,0.25)',
        /* Card hover */
        'card-hover': '0 16px 48px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,107,0,0.12), 0 0 32px rgba(255,107,0,0.06)',
        /* Inset surface */
        'inset-surface': 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.2)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
        'in-expo': 'cubic-bezier(0.95, 0.05, 0.795, 0.035)',
      },
      transitionDuration: {
        '200': '200ms',
        '250': '250ms',
        '300': '300ms',
        '350': '350ms',
      },
      animation: {
        'fade-in':         'fadeIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-up':        'slideUp 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-down':      'slideDown 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-right':     'slideRight 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in':        'scaleIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards',
        'pulse-slow':      'pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow':       'spin 12s linear infinite',
        'float':           'float 6s ease-in-out infinite',
        'glow-pulse':      'glowPulse 3s ease-in-out infinite',
        'shimmer':         'shimmer 2s linear infinite',
        'ambient-drift':   'ambientDrift 20s ease-in-out infinite',
        'gradient-flow':   'gradientFlow 6s ease infinite',
        'live-dot':        'liveDot 2s ease-in-out infinite',
        'cursor-blink':    'cursorBlink 1s step-end infinite',
      },
      keyframes: {
        fadeIn:        { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:       { from: { transform: 'translateY(16px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideDown:     { from: { transform: 'translateY(-8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideRight:    { from: { transform: 'translateX(-16px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        scaleIn:       { from: { transform: 'scale(0.94)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
        float:         { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
        glowPulse:     { '0%,100%': { boxShadow: '0 0 20px rgba(255,107,0,0.2)' }, '50%': { boxShadow: '0 0 40px rgba(255,107,0,0.45)' } },
        shimmer:       { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        ambientDrift:  { '0%,100%': { transform: 'translate(0,0) scale(1)', opacity: '0.4' }, '33%': { transform: 'translate(30px,-20px) scale(1.05)', opacity: '0.6' }, '66%': { transform: 'translate(-20px,15px) scale(0.97)', opacity: '0.35' } },
        gradientFlow:  { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        liveDot:       { '0%,100%': { transform: 'scale(1)', opacity: '1' }, '50%': { transform: 'scale(1.4)', opacity: '0.7' } },
        cursorBlink:   { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
      },
    },
  },
  plugins: [],
};

export default config;
