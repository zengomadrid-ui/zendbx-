'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Hero() {
  const [terminalStep, setTerminalStep] = useState(0);
  const [terminalText, setTerminalText] = useState('');
  
  const terminalSteps = [
    { text: '$ zendbx create my-app', delay: 50 },
    { text: '✓ Creating database...', delay: 800 },
    { text: '✓ Generating APIs...', delay: 600 },
    { text: '✓ Setting up auth...', delay: 600 },
    { text: '✓ Done in 3.2s', delay: 400 },
    { text: '\nYour backend is ready!', delay: 1000 },
  ];

  useEffect(() => {
    if (terminalStep >= terminalSteps.length) {
      setTimeout(() => {
        setTerminalStep(0);
        setTerminalText('');
      }, 3000);
      return;
    }

    const currentStep = terminalSteps[terminalStep];
    let i = 0;
    
    const timer = setInterval(() => {
      if (i <= currentStep.text.length) {
        setTerminalText(prev => prev + currentStep.text[i]);
        i++;
      } else {
        clearInterval(timer);
        setTimeout(() => {
          setTerminalText(prev => prev + '\n');
          setTerminalStep(prev => prev + 1);
        }, currentStep.delay);
      }
    }, 30);

    return () => clearInterval(timer);
  }, [terminalStep]);

  return (
    <section className="relative overflow-hidden bg-black pt-32 pb-24">
      {/* Animated background elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* Large orange glows */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-orange-600 rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-blob" />
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-orange-500 rounded-full mix-blend-screen filter blur-[100px] opacity-25 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-1/2 w-[700px] h-[700px] bg-orange-700 rounded-full mix-blend-screen filter blur-[140px] opacity-20 animate-blob animation-delay-4000" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ea580c08_1px,transparent_1px),linear-gradient(to_bottom,#ea580c08_1px,transparent_1px)] bg-[size:40px_40px]" />
        
        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)]" />
        
        {/* Floating code symbols */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 text-orange-500/10 text-6xl font-bold animate-float">{'{}'}</div>
          <div className="absolute top-40 right-20 text-orange-400/10 text-5xl font-bold animate-float animation-delay-1000">{'[]'}</div>
          <div className="absolute bottom-40 left-1/4 text-orange-600/10 text-7xl font-bold animate-float animation-delay-2000">{'</>'}</div>
          <div className="absolute top-1/2 right-1/3 text-orange-500/10 text-4xl font-bold animate-float animation-delay-3000">{'()'}</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Content */}
          <div className="text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600/20 to-orange-500/20 border border-orange-500/30 rounded-full mb-8 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              <span className="bg-gradient-to-r from-orange-400 to-orange-300 bg-clip-text text-transparent text-sm font-semibold">
                Backend Autopilot Platform
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
              <span className="text-white">Build Your Backend</span>
              <br />
              <span className="bg-gradient-to-r from-orange-500 via-orange-400 to-orange-600 bg-clip-text text-transparent animate-gradient">
                in 30 Seconds
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-xl sm:text-2xl text-gray-400 max-w-2xl leading-relaxed">
              No cap. AI-native platform that automatically creates database, APIs, and auth — <span className="text-orange-400 font-semibold">zero config</span>.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-start gap-4">
              <Link
                href="/signup"
                className="group relative w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-xl font-semibold overflow-hidden transition-all hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/50"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Start Building Free
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-orange-700 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              <button className="group w-full sm:w-auto px-8 py-4 border-2 border-orange-500/50 text-orange-200 rounded-xl font-semibold hover:border-orange-400 hover:bg-orange-500/10 transition-all backdrop-blur-sm">
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Watch Demo
                </span>
              </button>
            </div>

            {/* Trust signals */}
            <div className="mt-8 flex flex-wrap items-start gap-6 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>2 free projects forever</span>
              </div>
            </div>
          </div>

          {/* Right Side - Animated Terminal Demo */}
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-orange-600 to-orange-500 rounded-3xl blur-3xl opacity-40 animate-glow" />
            
            <div className="relative bg-black/80 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-orange-500/30 overflow-hidden">
              {/* Terminal Header */}
              <div className="bg-gradient-to-r from-zinc-900 to-black px-6 py-4 border-b-2 border-orange-500/30 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                </div>
                <div className="flex items-center gap-2 text-sm text-orange-400 font-semibold">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shadow-lg shadow-orange-500/50" />
                  <span>Live Demo</span>
                </div>
              </div>

              {/* Terminal Content */}
              <div className="p-8 bg-black min-h-[320px] font-mono text-sm">
                <pre className="text-gray-300 whitespace-pre-wrap">
                  {terminalText}
                  <span className="animate-pulse text-orange-500">|</span>
                </pre>
                
                {terminalStep >= terminalSteps.length - 1 && (
                  <div className="mt-6 p-5 bg-gradient-to-br from-orange-600/20 to-orange-500/10 border-2 border-orange-500/40 rounded-xl backdrop-blur-sm">
                    <div className="text-xs text-orange-400 font-semibold mb-2 uppercase tracking-wider">API Endpoint:</div>
                    <div className="text-orange-400 mb-4 font-mono text-sm">https://api.zendbx.com/abc123</div>
                    <button className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 text-white text-sm font-semibold rounded-lg hover:from-orange-500 hover:to-orange-400 transition-all shadow-lg shadow-orange-500/30">
                      Copy Credentials
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add custom animations */}
      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(5deg);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </section>
  );
}
