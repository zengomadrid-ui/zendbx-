'use client';

const steps = [
  {
    number: '1',
    title: 'Upload CSV',
    description: 'Drag and drop your CSV file. We automatically detect columns and data types.',
    icon: (
      <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
  {
    number: '2',
    title: 'Ask Questions',
    description: 'Type your question in plain English. Our AI understands natural language.',
    icon: (
      <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    number: '3',
    title: 'Get Answers',
    description: 'Receive results instantly with the generated SQL and a clear explanation.',
    icon: (
      <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ea580c06_1px,transparent_1px),linear-gradient(to_bottom,#ea580c06_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header */}
        <div className="text-center mb-20">
          <h2 className="text-4xl sm:text-5xl font-extrabold mb-3">
            <span className="text-white">Get Started</span>
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
              In 3 Simple Steps
            </span>
          </h2>
          <p className="text-gray-400 text-lg">No complex setup. No configuration. Just build.</p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">

          {/* Connector lines between cards (desktop) */}
          <div className="hidden md:block absolute top-[72px] left-[calc(33.33%+0px)] w-[calc(33.33%-0px)] h-px bg-gradient-to-r from-orange-500/40 to-orange-500/40 z-0" />
          <div className="hidden md:block absolute top-[72px] left-[calc(66.66%+0px)] w-[calc(33.33%-0px)] h-px bg-gradient-to-r from-orange-500/40 to-orange-500/40 z-0" />

          {steps.map((step, i) => (
            <div key={i} className="relative flex flex-col items-center pt-10">

              {/* Step number circle — sits on top edge */}
              <div className="absolute -top-0 left-1/2 -translate-x-1/2 z-20">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-orange-500/50">
                  {step.number}
                </div>
              </div>

              {/* Card */}
              <div className="w-full rounded-2xl border border-orange-500/30 bg-zinc-900/80 pt-12 pb-8 px-6 flex flex-col items-center text-center shadow-[0_0_30px_rgba(234,88,12,0.1)] hover:shadow-[0_0_40px_rgba(234,88,12,0.2)] hover:border-orange-500/60 transition-all duration-300">

                {/* Icon box */}
                <div className="w-16 h-16 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-5">
                  {step.icon}
                </div>

                <h3 className="text-white text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}