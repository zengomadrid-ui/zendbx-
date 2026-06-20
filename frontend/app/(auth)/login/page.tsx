'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch, getOAuthUrl } from '@/lib/fetch-utils';

function LoginForm() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState('');
  const [mounted, setMounted]   = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const urlError   = searchParams.get('error');
    const urlMessage = searchParams.get('message');
    if (urlError) setError(urlMessage || 'Authentication failed. Please try again.');
  }, [searchParams, mounted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const response = await apiFetch('api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }).catch(() => { throw new Error('Cannot connect to backend.'); });

      let data: any;
      try { data = await response.json(); } catch { throw new Error('Invalid response from server'); }
      if (!response.ok) throw new Error(data.detail || 'Login failed');

      localStorage.setItem('token',      data.access_token);
      localStorage.setItem('user_id',    data.user.id);
      localStorage.setItem('user_email', data.user.email);
      localStorage.setItem('user',       JSON.stringify(data.user));

      await new Promise(r => setTimeout(r, 100));

      try {
        const projectsResponse = await apiFetch('api/projects');
        if (projectsResponse.ok) {
          const projects = await projectsResponse.json();
          window.location.href = projects.length === 0 ? '/onboarding' : '/select-project';
        } else {
          window.location.href = '/select-project';
        }
      } catch {
        window.location.href = '/select-project';
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login. Please check your credentials.');
      setIsLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[40%] xl:w-[42%] relative flex-col items-center justify-center p-12 overflow-hidden">
        {/* Textured / gradient background */}
        <div className="absolute inset-0 bg-[#0a0a0a]" />
        {/* Radial glow — bottom-left amber */}
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-radial from-orange-700/30 via-orange-900/10 to-transparent rounded-full blur-3xl" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(#888 1px, transparent 1px), linear-gradient(90deg, #888 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 text-center">
          {/* Logo mark */}
          <div className="mb-8 flex justify-center">
            <img src="/logo.png" alt="ZendBX" className="h-14 w-auto" />
          </div>

          <h2 className="text-3xl font-bold text-white leading-snug">
            Build your instant<br />backend on ZendBX.
          </h2>
          <p className="mt-3 text-sm text-zinc-400 max-w-xs leading-relaxed mx-auto">
            Postgres, REST APIs, Auth, Storage and Realtime — all in one platform.
          </p>

          {/* Mini feature pills */}
          <div className="mt-8 flex flex-wrap gap-2 justify-center">
            {['Instant REST API', 'Auth built-in', 'Realtime', 'Storage'].map(f => (
              <span key={f} className="px-3 py-1 rounded-full bg-zinc-800/80 text-zinc-300 text-xs font-medium border border-zinc-700/60">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-black">
        {/* Back to home — mobile logo */}
        <div className="w-full max-w-sm mb-8 flex items-center justify-between lg:justify-end">
          <Link href="/" className="flex lg:hidden items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors">
            <img src="/logo.png" alt="ZendBX" className="h-7 w-auto" />
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Home
          </Link>
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-white text-center mb-1">
            Log in to ZendBX
          </h1>
          <p className="text-sm text-zinc-400 text-center mb-7">
            Connect to ZendBX with:
          </p>

          {/* OAuth buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => window.location.href = getOAuthUrl('google')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#111] border border-[#2a2a2a] hover:border-orange-500/40 hover:bg-[#1a1a1a] text-white text-sm font-medium transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            <button
              type="button"
              onClick={() => window.location.href = getOAuthUrl('github')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#111] border border-[#2a2a2a] hover:border-orange-500/40 hover:bg-[#1a1a1a] text-white text-sm font-medium transition-all"
            >
              <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
              </svg>
              GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-[#2a2a2a]" />
            <span className="text-xs text-zinc-500">Or continue with</span>
            <div className="flex-1 h-px bg-[#2a2a2a]" />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="Enter your email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#111] border border-[#2a2a2a] text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all"
                suppressHydrationWarning
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-zinc-300">Password</label>
                <Link href="/forgot-password" className="text-xs text-orange-500 hover:text-orange-400 transition-colors">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Enter a unique password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg bg-[#111] border border-[#2a2a2a] text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all"
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-orange-400 transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1 shadow-lg shadow-orange-500/20"
              suppressHydrationWarning
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Log in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            New to ZendBX?{' '}
            <Link href="/signup" className="text-orange-400 hover:text-orange-300 font-medium transition-colors">
              Sign up for an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
