'use client';

import { motion } from 'framer-motion';

const steps = [
  {
    number: '1',
    title: 'Upload CSV',
    description: 'Drag and drop your CSV file. We automatically detect columns and data types.',
    icon: (
      <svg className="w-16 h-16 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
  {
    number: '2',
    title: 'Ask Questions',
    description: 'Type your question in plain English. Our AI understands natural language.',
    icon: (
      <svg className="w-16 h-16 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    number: '3',
    title: 'Get Answers',
    description: 'Receive results instantly with the generated SQL and a clear explanation.',
    icon: (
      <svg className="w-16 h-16 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 bg-black relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ea580c08_1px,transparent_1px),linear-gradient(to_bottom,#ea580c08_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-orange-600 rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-blob" />
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-orange-500 rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-blob animation-delay-2000" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-20">
          <div className="inline-block mb-4">
            <span className="px-4 py-2 bg-gradient-to-r from-orange-600/20 to-orange-500/20 border border-orange-500/30 rounded-full text-sm font-semibold text-orange-300 backdrop-blur-sm">
              Simple Process
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="text-white">Get Started</span>
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
              In 3 Simple Steps
            </span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            No complex setup. No configuration. Just build.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 relative">
          {/* Connection lines for desktop */}
          <div className="hidden md:block absolute top-32 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />

          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* Card */}
              <div className="relative group">
                {/* Glow effect on hover */}
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-orange-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                
                <div className="relative bg-zinc-950 border-2 border-orange-500/20 rounded-2xl p-8 hover:border-orange-500/50 transition-all backdrop-blur-sm">
                  {/* Step number badge */}
                  <div className="flex justify-center mb-6 -mt-16">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-500 rounded-full blur-xl opacity-50" />
                      <div className="relative w-20 h-20 bg-gradient-to-br from-orange-600 to-orange-500 text-white rounded-full flex items-center justify-center text-3xl font-bold shadow-2xl border-4 border-black">
                        {step.number}
                      </div>
                    </div>
                  </div>

                  {/* Icon */}
                  <div className="flex justify-center mb-6">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-orange-600/20 to-orange-500/10 border-2 border-orange-500/30">
                      {step.icon}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-orange-400 transition-colors">
                      {step.title}
                    </h3>
                    <p className="text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Time indicator */}
        <div className="mt-20 text-center">
          <div className="relative inline-block">
            <div className="absolute -inset-2 bg-gradient-to-r from-orange-600 to-orange-500 rounded-2xl blur-2xl opacity-40" />
            <div className="relative inline-flex items-center gap-3 px-8 py-4 bg-zinc-950 border-2 border-orange-500/30 rounded-2xl backdrop-blur-sm">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-500 rounded-full blur-md opacity-50" />
                <div className="relative w-10 h-10 bg-gradient-to-br from-orange-600 to-orange-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <div className="text-left">
                <div className="text-sm text-orange-400 font-medium">Average Time</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                  Under 30 Seconds
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </section>
  );
}
