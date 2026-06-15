import Link from 'next/link';

const COLS = {
  Product:    [['Features', '#features'], ['Pricing', '#pricing'], ['Changelog', '/changelog'], ['Roadmap', '/roadmap'], ['Status', '/status']],
  Developers: [['Docs', '/docs'], ['SDK', '/docs/sdk'], ['REST API', '/docs/rest'], ['CLI', '/docs/cli'], ['GitHub', 'https://github.com']],
  Company:    [['About', '/about'], ['Blog', '/blog'], ['Community', '/community'], ['Careers', '/careers'], ['Contact', '/contact']],
};

export default function Footer() {
  return (
    <footer className="bg-[#000] border-t border-white/5">
      <div className="max-w-6xl mx-auto px-4 pt-16 pb-10">

        {/* Top: brand + cols */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          <div className="col-span-2 md:col-span-1">
            {/* Logo */}
            <Link href="/" className="inline-flex items-center gap-2.5 mb-5 group">
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                <span className="text-black font-black text-sm">Z</span>
              </div>
              <span className="text-white font-bold text-[15px]">ZendBX</span>
            </Link>
            <p className="text-sm text-neutral-700 leading-relaxed max-w-[220px]">
              The instant backend platform for modern developers.
            </p>
            {/* Social */}
            <div className="flex gap-2 mt-5">
              {[
                { label: 'GitHub', href: 'https://github.com', icon: <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.1 3.29 9.43 7.86 10.96.57.1.78-.25.78-.56v-2c-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.67 1.24 3.32.95.1-.74.4-1.24.72-1.53-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.18-1.48 3.14-1.17 3.14-1.17.63 1.57.23 2.73.11 3.02.74.8 1.18 1.82 1.18 3.07 0 4.4-2.68 5.37-5.24 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.2.67.79.56C20.71 21.43 24 17.1 24 12 24 5.73 18.27.5 12 .5z" />, fill: true },
                { label: 'X', href: 'https://x.com', icon: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />, fill: true },
              ].map(({ label, href, icon, fill }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center transition-colors group">
                  <svg className="w-4 h-4 text-neutral-600 group-hover:text-neutral-300 transition-colors" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'}>
                    {icon}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {Object.entries(COLS).map(([group, links]) => (
            <div key={group}>
              <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-neutral-700 mb-4">{group}</p>
              <ul className="space-y-3">
                {links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-sm text-neutral-600 hover:text-white transition-colors duration-150">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.04] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-neutral-800">© {new Date().getFullYear()} ZendBX, Inc. All rights reserved.</p>
          <div className="flex items-center gap-5">
            {[['Privacy', '/privacy'], ['Terms', '/terms'], ['Security', '/security']].map(([l, h]) => (
              <Link key={l} href={h} className="text-[12px] text-neutral-800 hover:text-neutral-400 transition-colors">{l}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
