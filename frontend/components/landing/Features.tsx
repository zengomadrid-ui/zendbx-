'use client';

import { motion } from 'framer-motion';

const features = [
  {
    icon: (
      <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    title: 'Auto Database Creation',
    description: 'Instantly generates isolated PostgreSQL database for each project. Complete multi-tenant architecture out of the box.',
  },
  {
    icon: (
      <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Instant REST APIs',
    description: 'Every table automatically becomes a fully functional API endpoint. No coding required, just create and use.',
  },
  {
    icon: (
      <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: 'Built-in Authentication',
    description: 'JWT, OAuth, and session tracking ready out of the box. Secure by default with zero configuration.',
  },
  {
    icon: (
      <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'AI-Powered Assistant',
    description: 'Natural language to SQL. Describe what you need and AI builds your schema, queries, and logic.',
  },
  {
    icon: (
      <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    title: 'Multi-Tenant Ready',
    description: 'Each project gets isolated database. Perfect for SaaS applications with complete data separation.',
  },
  {
    icon: (
      <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Spreadsheet-Like UI',
    description: 'Manage data with intuitive interface like Airtable, while retaining full SQL power underneath.',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-black relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ea580c08_1px,transparent_1px),linear-gradient(to_bottom,#ea580c08_1px,transparent_1px)] bg-[size:40px_40px]" />
      
      {/* Orange glow spots */}
      <div className="absolute top-1/4 left-0 w-96 h-96 bg-orange-600 rounded-full mix-blend-screen filter blur-[120px] opacity-20" />
      <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-orange-500 rounded-full mix-blend-screen filter blur-[120px] opacity-20" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-block mb-4">
            <span className="px-4 py-2 bg-gradient-to-r from-orange-600/20 to-orange-500/20 border border-orange-500/30 rounded-full text-sm font-semibold text-orange-300 backdrop-blur-sm">
              Powerful Features
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="text-white">Everything You Need</span>
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
              Built-In and Ready
            </span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Complete backend platform with database, APIs, auth, and more
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group relative"
            >
              {/* Gradient border effect */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-600 to-orange-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-sm" />
              
              <div className="relative bg-zinc-950 rounded-2xl p-8 border-2 border-orange-500/20 hover:border-orange-500/50 transition-all duration-300 h-full backdrop-blur-sm group-hover:bg-zinc-900">
                {/* Icon with gradient background */}
                <div className="mb-5 inline-flex p-4 rounded-xl bg-gradient-to-br from-orange-600/20 to-orange-500/10 border-2 border-orange-500/30 group-hover:border-orange-500/50 transition-all">
                  {feature.icon}
                </div>
                
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-orange-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Additional features grid */}
        <div className="mt-16 relative">
          <div className="absolute -inset-2 bg-gradient-to-r from-orange-600 to-orange-500 rounded-3xl blur-3xl opacity-30" />
          
          <div className="relative bg-zinc-950/90 backdrop-blur-xl rounded-2xl border-2 border-orange-500/30 p-10">
            <h3 className="text-3xl font-bold text-center mb-10">
              <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent animate-gradient">
                Plus Many More Features
              </span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                'Zero configuration setup',
                'Automatic API generation',
                'Real-time data sync',
                'CSV/JSON import',
                'Role-based access control',
                'API playground',
                'SQL editor',
                'Audit logging',
                'Backup & restore',
              ].map((feature) => (
                <div key={feature} className="flex items-center space-x-3 p-4 rounded-xl hover:bg-orange-500/10 transition-all border border-transparent hover:border-orange-500/30 group">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-orange-600 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:shadow-orange-500/50 transition-all">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-300 font-medium group-hover:text-orange-300 transition-colors">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
