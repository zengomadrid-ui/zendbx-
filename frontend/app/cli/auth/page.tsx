'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/fetch-utils';

function CLIAuthFlow() {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<'checking' | 'not_logged_in' | 'authenticating' | 'success' | 'error'>('checking');
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !sessionId) return;

    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
      // User is logged in, complete CLI authentication
      completeCLIAuth(sessionId, token, JSON.parse(user));
    } else {
      // User needs to log in
      setStatus('not_logged_in');
    }
  }, [mounted, sessionId]);

  const completeCLIAuth = async (sessionId: string, token: string, user: any) => {
    setStatus('authenticating');
    
    try {
      // Send auth completion to backend
      const response = await apiFetch(`/api/cli/auth/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          token: token,
          user: user
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete CLI authentication');
      }

      setStatus('success');
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate CLI');
      setStatus('error');
    }
  };

  if (!mounted) {
    return <LoadingSpinner />;
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invalid CLI Auth Request</h1>
          <p className="text-[#71717A] text-sm mb-6">
            Missing session ID. Please try running the CLI login command again.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#FF6B00] hover:bg-[#e85e00] transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'checking') {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  if (status === 'not_logged_in') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            <img src="/logo.png" alt="ZendBX" className="h-14 w-auto mx-auto" style={{ filter: 'drop-shadow(0 0 24px rgba(255,107,0,0.4))' }} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">CLI Authentication</h1>
          <p className="text-[#71717A] text-sm mb-8">
            Please log in to authenticate your ZendBX CLI
          </p>
          
          <div className="space-y-3">
            <Link
              href={`/login?redirect=/cli/auth?session_id=${sessionId}`}
              className="block w-full py-3 rounded-xl text-white font-semibold text-sm transition-all"
              style={{ background: 'linear-gradient(135deg, #FF6B00, #e85e00)', boxShadow: '0 4px 16px rgba(255,107,0,0.3)' }}
            >
              Log in to Continue
            </Link>
            
            <Link
              href={`/signup?redirect=/cli/auth?session_id=${sessionId}`}
              className="block w-full py-3 rounded-xl text-white font-medium text-sm transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              Create Account
            </Link>
          </div>

          <p className="mt-6 text-xs text-[#52525B]">
            This will authorize the ZendBX CLI to access your account
          </p>
        </div>
      </div>
    );
  }

  if (status === 'authenticating') {
    return <LoadingSpinner message="Authenticating CLI..." />;
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">CLI Authenticated!</h1>
          <p className="text-[#71717A] text-sm mb-6">
            You can now close this window and return to your terminal.
          </p>
          <div className="px-4 py-3 rounded-xl text-xs text-green-400 font-mono"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            zendbx auth whoami
          </div>
          <p className="mt-4 text-xs text-[#52525B]">
            Run this command to verify your authentication
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Authentication Failed</h1>
          <p className="text-[#71717A] text-sm mb-6">
            {error || 'Something went wrong. Please try again.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#FF6B00] hover:bg-[#e85e00] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(255,107,0,0.15)' }} />
        <div className="relative w-12 h-12 rounded-full border-2 border-[#FF6B00]/30 border-t-[#FF6B00] animate-spin" />
      </div>
      <p className="text-sm text-[#71717A]">{message}</p>
    </div>
  );
}

export default function CLIAuthPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CLIAuthFlow />
    </Suspense>
  );
}
