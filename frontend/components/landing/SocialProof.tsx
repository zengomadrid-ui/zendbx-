'use client';

const TECHS = ['Next.js', 'React', 'Vue', 'Svelte', 'Node.js', 'Python', 'Go', 'Flutter', 'React Native', 'Remix'];

export default function SocialProof() {
  return (
    <section className="bg-[#000] border-y border-white/5 py-6 overflow-hidden">
      <p className="text-center text-[11px] font-semibold tracking-[0.15em] uppercase text-neutral-700 mb-5">
        Works with every stack
      </p>
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right, #000, transparent)' }} />
        <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to left, #000, transparent)' }} />
        <div className="flex gap-12 animate-[marquee_25s_linear_infinite] whitespace-nowrap">
          {[...TECHS, ...TECHS].map((t, i) => (
            <span key={i} className="text-sm font-semibold text-neutral-800 hover:text-neutral-500 transition-colors cursor-default select-none">
              {t}
            </span>
          ))}
        </div>
      </div>
      <style jsx>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
