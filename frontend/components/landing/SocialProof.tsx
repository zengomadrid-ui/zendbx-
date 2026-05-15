export default function SocialProof() {
  return (
    <section className="py-16 bg-zinc-900 border-y border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-8">
            Trusted by 10,000+ data teams worldwide
          </p>
          
          {/* Company Logos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300">
            <div className="text-2xl font-bold text-gray-600">Company A</div>
            <div className="text-2xl font-bold text-gray-600">Company B</div>
            <div className="text-2xl font-bold text-gray-600">Company C</div>
            <div className="text-2xl font-bold text-gray-600">Company D</div>
          </div>

          {/* Rating */}
          <div className="mt-12 flex items-center justify-center space-x-2">
            <div className="flex space-x-1">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className="w-5 h-5 text-orange-500 fill-current"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                </svg>
              ))}
            </div>
            <span className="text-gray-300 font-semibold">4.9/5</span>
            <span className="text-gray-500">from 500+ reviews</span>
          </div>
        </div>
      </div>
    </section>
  );
}
