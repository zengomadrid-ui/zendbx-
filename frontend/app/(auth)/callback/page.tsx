'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      // Check for errors from OAuth provider
      const error = searchParams.get('error');
      const errorMessage = searchParams.get('message');
      
      if (error) {
        setStatus('error');
        
        // User-friendly error messages
        const errorMessages: Record<string, string> = {
          'access_denied': 'You cancelled the login process',
          'invalid_state': 'Security validation failed. Please try again',
          'missing_state': 'Security validation failed. Please try again',
          'no_email': 'Email address is required but was not provided by the OAuth provider',
          'oauth_failed': errorMessage || 'Authentication failed. Please try again',
          'invalid_client': 'OAuth configuration error. Please contact support',
          'server_error': 'Server error occurred. Please try again later'
        };
        
        setMessage(errorMessages[error] || errorMessage || 'Authentication failed');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login');
        }, 3000);
        return;
      }

      // Get token from URL
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('No authentication token received');
        setTimeout(() => {
          router.push('/login');
        }, 3000);
        return;
      }

      try {
        // Store token
        localStorage.setItem('token', token);
        
        // Fetch user info
        const response = await fetch('http://localhost:8000/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user information');
        }

        const user = await response.json();
        
        // Store user info
        localStorage.setItem('user_id', user.id);
        localStorage.setItem('user_email', user.email);
        localStorage.setItem('user', JSON.stringify(user));

        setStatus('success');
        setMessage('Login successful! Redirecting...');

        // Redirect to dashboard
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);

      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        setMessage('Failed to complete authentication');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-zinc-800 border border-gray-700 rounded-2xl p-8 text-center">
          {/* Logo */}
          <div className="mb-6">
            <Link href="/" className="inline-flex items-center">
              <img src="/logo.png" alt="ZENDBX" className="h-12 w-auto mx-auto" />
            </Link>
          </div>

          {/* Status Icon */}
          <div className="mb-6">
            {status === 'loading' && (
              <div className="w-16 h-16 mx-auto">
                <svg className="animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
            
            {status === 'success' && (
              <div className="w-16 h-16 mx-auto bg-green-600/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            
            {status === 'error' && (
              <div className="w-16 h-16 mx-auto bg-red-600/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>

          {/* Message */}
          <h2 className="text-xl font-bold text-white mb-2">
            {status === 'loading' && 'Authenticating...'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Authentication Failed'}
          </h2>
          
          <p className="text-gray-400 text-sm mb-6">
            {message}
          </p>

          {/* Actions */}
          {status === 'error' && (
            <div className="space-y-3">
              <Link
                href="/login"
                className="block w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Back to Login
              </Link>
              <Link
                href="/"
                className="block w-full px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Go Home
              </Link>
            </div>
          )}

          {status === 'loading' && (
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <span>Please wait</span>
              <span className="animate-pulse">...</span>
            </div>
          )}
        </div>

        {/* Help Text */}
        <p className="text-center text-xs text-gray-500 mt-4">
          Having trouble? <Link href="/login" className="text-orange-500 hover:text-orange-400">Try again</Link>
        </p>
      </div>
    </div>
  );
}
