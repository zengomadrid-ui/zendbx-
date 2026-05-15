'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      router.push(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (token) {
      localStorage.setItem('token', token);
      
      // Fetch user data
      fetch('http://localhost:8000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(user => {
          localStorage.setItem('user_id', user.id);
          localStorage.setItem('user_email', user.email);
          localStorage.setItem('user', JSON.stringify(user));
          window.location.href = '/dashboard';
        })
        .catch(() => {
          router.push('/login?error=Authentication failed');
        });
    } else {
      router.push('/login');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-500 rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
          <span className="text-white font-bold text-2xl">N</span>
        </div>
        <p className="text-sm text-gray-400">Completing authentication...</p>
      </div>
    </div>
  );
}
