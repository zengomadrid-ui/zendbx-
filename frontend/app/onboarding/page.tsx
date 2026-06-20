'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/fetch-utils';

const REGIONS = [
  { value: 'ap-south-1',    label: 'Asia Pacific (Mumbai)',     code: 'IN', lon:  73, lat: 19 },
  { value: 'us-east-1',     label: 'US East (N. Virginia)',     code: 'US', lon: -78, lat: 39 },
  { value: 'us-west-2',     label: 'US West (Oregon)',          code: 'US', lon:-120, lat: 44 },
  { value: 'eu-central-1',  label: 'Europe (Frankfurt)',        code: 'EU', lon:  10, lat: 50 },
  { value: 'ap-southeast-1',label: 'Asia Pacific (Singapore)',  code: 'SG', lon: 104, lat:  1 },
  { value: 'ap-northeast-1',label: 'Asia Pacific (Tokyo)',      code: 'JP', lon: 140, lat: 36 },
];

function generatePassword() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  return Array.from({length:20},()=>c[Math.floor(Math.random()*c.length)]).join('');
}

// Is (lon, lat) roughly over land?
function isLand(lon: number, lat: number): boolean {
  if (lon>=-170&&lon<=-50&&lat>=20&&lat<=75)  return true; // N America
  if (lon>=-85 &&lon<=-30&&lat>=-60&&lat<=15) return true; // S America
  if (lon>=-15 &&lon<=45 &&lat>=36&&lat<=72)  return true; // Europe
  if (lon>=-20 &&lon<=55 &&lat>=-38&&lat<=38) return true; // Africa
  if (lon>=30  &&lon<=180&&lat>=50&&lat<=80)  return true; // Russia
  if (lon>=25  &&lon<=65 &&lat>=10&&lat<=40)  return true; // Middle East
  if (lon>=65  &&lon<=100&&lat>=5 &&lat<=38)  return true; // S Asia
  if (lon>=95  &&lon<=145&&lat>=-10&&lat<=25) return true; // SE Asia
  if (lon>=100 &&lon<=145&&lat>=25&&lat<=55)  return true; // E Asia
  if (lon>=112 &&lon<=155&&lat>=-45&&lat<=-10)return true; // Australia
  if (lon>=130 &&lon<=146&&lat>=30&&lat<=46)  return true; // Japan
  if (lon>=-60 &&lon<=-18&&lat>=60&&lat<=85)  return true; // Greenland
  return false;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [dbPassword,  setDbPassword]  = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [region,      setRegion]      = useState('ap-south-1');
  const [serverSize,  setServerSize]  = useState('shared');
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) router.push('/login');
  }, [router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !dbPassword.trim()) return;
    setIsLoading(true); setError('');
    try {
      const response = await apiFetch('api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName, description: 'My first project', region }),
      });
      if (!response.ok) {
        const data = await response.json().catch(()=>({}));
        throw new Error(data.detail || `Failed (${response.status})`);
      }
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
      setIsLoading(false);
    }
  };

  const sel = REGIONS.find(r => r.value === region) || REGIONS[0];

  // Compute pin position on 3D sphere (SVG 520x520, R=238, center 260,260)
  const R = 238; const CX = 260; const CY = 260;
  const rotY = 20 * Math.PI / 180;
  function regionPin(r: typeof REGIONS[0]) {
    const lonRad = r.lon * Math.PI / 180;
    const latRad = r.lat * Math.PI / 180;
    const x3 = Math.cos(latRad)*Math.cos(lonRad);
    const y3 = Math.sin(latRad);
    const z3 = Math.cos(latRad)*Math.sin(lonRad);
    const x4 = x3*Math.cos(rotY)+z3*Math.sin(rotY);
    const z4 = -x3*Math.sin(rotY)+z3*Math.cos(rotY);
    return { sx: CX + R*z4, sy: CY - R*y3, visible: x4 > -0.1 };
  }
  const pin = regionPin(sel);

  // Pre-generate dots for the globe (land only)
  const globeDots: { cx:number; cy:number; r:number; op:number }[] = [];
  for (let latDeg = -85; latDeg <= 85; latDeg += 3.8) {
    const latRad = latDeg * Math.PI / 180;
    const lonStep = Math.max(5, 3.8 / Math.cos(latRad));
    for (let lonDeg = -180; lonDeg < 180; lonDeg += lonStep) {
      if (!isLand(lonDeg, latDeg)) continue;
      const lonRad = lonDeg * Math.PI / 180;
      const x3 = Math.cos(latRad)*Math.cos(lonRad);
      const y3 = Math.sin(latRad);
      const z3 = Math.cos(latRad)*Math.sin(lonRad);
      const x4 = x3*Math.cos(rotY)+z3*Math.sin(rotY);
      const z4 = -x3*Math.sin(rotY)+z3*Math.cos(rotY);
      if (x4 < -0.08) continue;
      const cx = CX + R*z4;
      const cy = CY - R*y3;
      const depth = (x4 + 1) / 2;
      const dotR = 1.2 + depth * 2.0;
      const op = 0.18 + depth * 0.72;
      globeDots.push({ cx, cy, r: dotR, op });
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <style>{`
        @keyframes pinPulse {
          0%   { r:8;  opacity:0.7; }
          60%  { r:24; opacity:0;   }
          100% { r:8;  opacity:0.7; }
        }
        .pin-pulse { animation: pinPulse 2s ease-out infinite; }
      `}</style>

      {/* ── LEFT: Form ── */}
      <div className="flex-1 overflow-y-auto px-8 py-10 md:px-12 lg:px-16 max-w-[520px]">
        <div className="flex items-center gap-2 mb-8">
          <img src="/logo.png" alt="ZendBX" className="h-7 w-auto"/>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Create a New Project</h1>
        <p className="text-sm text-[#888] mb-8">Each project gets its own PostgreSQL database with configurable resources</p>

        {error && <div className="mb-6 px-4 py-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 text-sm">{error}</div>}

        <form onSubmit={handleCreate} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-[#ccc] mb-2">Name</label>
            <input type="text" required placeholder="Project name"
              value={projectName} onChange={e=>setProjectName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#141414] border border-[#2a2a2a] text-white placeholder-[#444] text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all"
              suppressHydrationWarning/>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-[#ccc] mb-2">Database Password</label>
            <div className="relative">
              <input type={showPass?'text':'password'} required placeholder="Type in a strong password"
                value={dbPassword} onChange={e=>setDbPassword(e.target.value)}
                className="w-full px-4 py-3 pr-20 rounded-lg bg-[#141414] border border-[#2a2a2a] text-white placeholder-[#444] text-sm font-mono focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all"
                suppressHydrationWarning/>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button type="button" onClick={()=>navigator.clipboard?.writeText(dbPassword)} className="text-[#555] hover:text-orange-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                </button>
                <button type="button" onClick={()=>setShowPass(v=>!v)} className="text-[#555] hover:text-orange-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showPass
                      ?<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                      :<><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></>
                    }
                  </svg>
                </button>
              </div>
            </div>
            <button type="button" onClick={()=>setDbPassword(generatePassword())}
              className="mt-2 text-xs text-orange-500 hover:text-orange-400 transition-colors underline underline-offset-2">
              Generate a password
            </button>
          </div>

          {/* Region */}
          <div>
            <label className="block text-sm font-medium text-[#ccc] mb-2">Region</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-6 rounded bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center pointer-events-none">
                <span className="text-[9px] font-bold text-orange-400">{sel.code}</span>
              </div>
              <select value={region} onChange={e=>setRegion(e.target.value)}
                className="w-full pl-14 pr-4 py-3 rounded-lg bg-[#141414] border border-[#2a2a2a] text-white text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all appearance-none"
                suppressHydrationWarning>
                {REGIONS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </div>
            <p className="mt-2 text-xs text-[#555]">Select a region close to your users for the best performance.</p>
          </div>

          {/* Server Size */}
          <div>
            <label className="block text-sm font-medium text-[#ccc] mb-3">Server Size</label>
            <div className="space-y-2">
              <label className={`flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition-all ${serverSize==='shared'?'border-orange-500 bg-orange-500/10':'border-[#2a2a2a] bg-[#141414] hover:border-[#3a3a3a]'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${serverSize==='shared'?'border-orange-500':'border-[#444]'}`}>
                    {serverSize==='shared'&&<div className="w-2 h-2 rounded-full bg-orange-500"/>}
                  </div>
                  <span className="text-sm font-semibold text-white">Shared</span>
                  <span className="text-xs text-[#666]">500 MB Storage · 2GB Egress</span>
                </div>
                <span className="text-sm font-bold text-white">Free <span className="text-[#555] font-normal">$0/mo</span></span>
                <input type="radio" className="sr-only" value="shared" checked={serverSize==='shared'} onChange={()=>setServerSize('shared')}/>
              </label>
              {[{n:'Nano',spec:'1 vCPU · 256MB RAM · 5GB SSD',price:'Free with Pro'},
                {n:'Micro',spec:'1 vCPU · 512MB RAM · 10GB SSD',price:'$0.018/hr'}].map(s=>(
                <div key={s.n} className="flex items-center justify-between px-4 py-3 rounded-lg border border-[#1e1e1e] bg-[#0d0d0d] opacity-40 cursor-not-allowed">
                  <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full border-2 border-[#333] flex-shrink-0"/><span className="text-sm font-semibold text-[#888]">{s.n}</span><span className="text-xs text-[#444]">{s.spec}</span></div>
                  <div className="flex items-center gap-1.5 text-xs text-[#444]"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>{s.price}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-orange-500/70">Upgrade to Pro to unlock dedicated servers →</p>
          </div>

          <button type="submit" disabled={isLoading||!projectName.trim()||!dbPassword.trim()}
            className="w-full py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20">
            {isLoading?(
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Creating project...
              </span>
            ):'Create New Project'}
          </button>
        </form>
      </div>

      {/* ── RIGHT: 3D Dotted Globe ── */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative bg-[#060606] overflow-hidden">
        {/* Radial glow */}
        <div className="absolute rounded-full pointer-events-none"
          style={{width:560,height:560,background:'radial-gradient(circle, rgba(249,115,22,0.1) 0%, transparent 65%)'}}/>

        <div className="relative flex items-center justify-center">
          <svg width="540" height="540" viewBox="0 0 520 520">
            <defs>
              {/* 3D sphere shading — dark edges, lighter center-left */}
              <radialGradient id="sd" cx="35%" cy="30%" r="65%">
                <stop offset="0%"   stopColor="#1a0a00" stopOpacity="0.4"/>
                <stop offset="55%"  stopColor="#050200" stopOpacity="0.6"/>
                <stop offset="100%" stopColor="#000000" stopOpacity="0.94"/>
              </radialGradient>
              {/* Sphere glow */}
              <radialGradient id="sg" cx="38%" cy="33%" r="58%">
                <stop offset="0%"   stopColor="#f97316" stopOpacity="0.14"/>
                <stop offset="55%"  stopColor="#7c3500" stopOpacity="0.04"/>
                <stop offset="100%" stopColor="#000000" stopOpacity="0"/>
              </radialGradient>
              <clipPath id="sc"><circle cx="260" cy="260" r="238"/></clipPath>
            </defs>
            {/* Sphere base */}
            <circle cx="260" cy="260" r="238" fill="#040404"/>
            <circle cx="260" cy="260" r="238" fill="url(#sg)"/>
            {/* Land dots */}
            <g clipPath="url(#sc)">
              {globeDots.map((d,i)=>(
                <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="#f97316" opacity={d.op}/>
              ))}
            </g>
            {/* 3D shading overlay */}
            <circle cx="260" cy="260" r="238" fill="url(#sd)"/>
            {/* Thin border */}
            <circle cx="260" cy="260" r="238" fill="none" stroke="#f97316" strokeWidth="0.7" strokeOpacity="0.15"/>

            {/* Active pin with animated pulse */}
            {pin.visible && (
              <g transform={`translate(${pin.sx}, ${pin.sy})`}
                style={{transition:'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)'}}>
                <circle r="8" fill="#f97316" fillOpacity="0" className="pin-pulse"/>
                <circle r="9"  fill="#f97316" fillOpacity="0.25"/>
                <circle r="5"  fill="#f97316" fillOpacity="0.95"/>
                <circle r="2.5" fill="white"/>
              </g>
            )}
            {/* Dim dots for other regions */}
            {REGIONS.filter(r=>r.value!==region).map(r=>{
              const p = regionPin(r);
              return p.visible ? (
                <g key={r.value} transform={`translate(${p.sx}, ${p.sy})`}>
                  <circle r="2.5" fill="#f97316" fillOpacity="0.25"/>
                </g>
              ) : null;
            })}
          </svg>

          {/* Feature card — reactive to region change */}
          <div className="absolute bottom-6 right-0 w-72 bg-[#0e0e0e]/95 backdrop-blur border border-[#252525] rounded-2xl p-5 shadow-2xl"
            style={{transition:'opacity 0.3s ease'}}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-orange-500/20 border border-orange-500/25 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#555] uppercase tracking-widest">Region</div>
                <div className="text-sm font-bold text-white leading-tight">{sel.label}</div>
              </div>
            </div>
            <div className="border-t border-[#1c1c1c] pt-3">
              <div className="text-[10px] font-semibold text-[#555] uppercase tracking-widest mb-3">Your free plan includes:</div>
              {['500 MB storage','Instant REST API','Auth & OAuth built-in','Realtime subscriptions','S3-compatible storage'].map(f=>(
                <div key={f} className="flex items-center gap-2 text-[13px] font-semibold text-white mb-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0"/>
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
