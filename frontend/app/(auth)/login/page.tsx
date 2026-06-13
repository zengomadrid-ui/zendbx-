'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, getOAuthUrl } from '@/lib/fetch-utils';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const urlError = searchParams.get('error');
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
      let data;
      try { data = await response.json(); } catch { throw new Error('Invalid response from server'); }
      if (!response.ok) throw new Error(data.detail || 'Login failed');
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user_id', data.user.id);
      localStorage.setItem('user_email', data.user.email);
      localStorage.setItem('user', JSON.stringify(data.user));
      await new Promise(r => setTimeout(r, 100));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to login. Please check your credentials.');
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f0f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <style>{`
        .auth-input {
          width: 100%;
          padding: 14px 16px;
          background-color: #1c1c22;
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
          transition: box-shadow 0.2s;
        }
        .auth-input:focus {
          box-shadow: 0 0 0 2px #f97316;
        }
        .auth-input::placeholder { color: #71717a; }
        .auth-input:-webkit-autofill,
        .auth-input:-webkit-autofill:hover,
        .auth-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0px 1000px #1c1c22 inset !important;
          -webkit-text-fill-color: #ffffff !important;
        }
      `}</style>

      {/* Logo */}
      <Link href="/" style={{ marginBottom: '2rem' }}>
        <img src="/logo.png" alt="ZENDBX" style={{ height: '48px', width: 'auto', filter: 'none' }} />
      </Link>

      <div style={{ width: '100%', maxWidth: '420px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#18181b', textAlign: 'center', marginBottom: '4px' }}>
          Welcome back
        </h1>
        <p style={{ fontSize: '14px', color: '#71717a', textAlign: 'center', marginBottom: '28px' }}>
          Sign in to your account to continue
        </p>

        {mounted && error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#27272a', marginBottom: '6px' }}>
              Email address
            </label>
            <input
              type="email" autoComplete="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="auth-input"
              suppressHydrationWarning
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#27272a', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password" autoComplete="current-password" required
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="auth-input"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#52525b' }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#f97316' }} />
              Remember me
            </label>
            <Link href="/forgot-password" style={{ fontSize: '14px', fontWeight: 600, color: '#f97316', textDecoration: 'none' }}>
              Forgot password?
            </Link>
          </div>

          <button type="submit" disabled={isLoading} style={{
            width: '100%', padding: '14px', background: '#f97316', color: '#ffffff',
            fontWeight: 700, fontSize: '16px', borderRadius: '12px', border: 'none',
            cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1,
            boxShadow: '0 4px 20px rgba(249,115,22,0.4)', transition: 'opacity 0.2s',
          }}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#d4d4d8' }} />
            <span style={{ fontSize: '12px', color: '#a1a1aa', whiteSpace: 'nowrap' }}>Or continue with</span>
            <div style={{ flex: 1, height: '1px', background: '#d4d4d8' }} />
          </div>

          {/* OAuth */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button type="button" onClick={() => window.location.href = getOAuthUrl('google')} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '12px 16px', background: '#f4f4f5', border: '1px solid #e4e4e7',
              borderRadius: '12px', fontSize: '14px', fontWeight: 500, color: '#3f3f46',
              cursor: 'pointer', transition: 'background 0.2s',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            <button type="button" onClick={() => window.location.href = getOAuthUrl('github')} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '12px 16px', background: '#f4f4f5', border: '1px solid #e4e4e7',
              borderRadius: '12px', fontSize: '14px', fontWeight: 500, color: '#3f3f46',
              cursor: 'pointer', transition: 'background 0.2s',
            }}>
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
              </svg>
              GitHub
            </button>
          </div>

          <p style={{ textAlign: 'center', fontSize: '14px', color: '#71717a', marginTop: '4px' }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" style={{ fontWeight: 600, color: '#f97316', textDecoration: 'none' }}>
              Sign up for free
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #f97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}