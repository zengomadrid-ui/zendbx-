import Link from 'next/link';

export default function CTA() {
  return (
    <section className="py-24 bg-black relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-orange-600 rounded-full mix-blend-screen filter blur-[140px] opacity-40" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-orange-500 rounded-full mix-blend-screen filter blur-[120px] opacity-40" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ea580c08_1px,transparent_1px),linear-gradient(to_bottom,#ea580c08_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
        <h2 className="text-4xl sm:text-6xl font-bold mb-6">
          <span className="text-white">Ready to Build</span>
          <br />
          <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent animate-gradient">
            Your Backend?
          </span>
        </h2>
        <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
          Start building in 30 seconds. No credit card required.
        </p>
        
        <Link
          href="/signup"
          className="inline-block px-10 py-5 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-xl font-bold text-lg hover:from-orange-500 hover:to-orange-400 transition-all shadow-2xl shadow-orange-500/40 hover:shadow-orange-500/60 transform hover:-translate-y-1"
        >
          Start Building Free →
        </Link>

        <p className="mt-6 text-gray-400 text-sm">
          ✓ No credit card required • ✓ 2 free projects forever • ✓ 30 second setup
        </p>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
          <div>
            <div className="text-4xl font-bold text-white mb-2">10,000+</div>
            <div className="text-orange-100">Projects Created</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-2">50,000+</div>
            <div className="text-orange-100">APIs Generated</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-2">99.9%</div>
            <div className="text-orange-100">Uptime</div>
          </div>
        </div>
      </div>
    </section>
  );
}
