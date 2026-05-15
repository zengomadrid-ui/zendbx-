'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for trying out ZENDBX',
    features: [
      '2 projects',
      '1 GB storage per project',
      'Community support',
      'All core features',
      'API access',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For professionals and small teams',
    features: [
      'Unlimited projects',
      '10 GB storage per project',
      'Priority support',
      'Advanced features',
      'Custom domains',
      'Team collaboration',
      'API rate limits: 10k/day',
    ],
    cta: 'Start Pro Trial',
    highlighted: true,
  },
  {
    name: 'Team',
    price: '$99',
    period: '/month',
    description: 'For growing teams and organizations',
    features: [
      'Everything in Pro',
      '100 GB storage per project',
      'Dedicated support',
      'SSO authentication',
      'Advanced RBAC',
      'Audit logs',
      'API rate limits: 100k/day',
      'SLA guarantee',
    ],
    cta: 'Start Team Trial',
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-black relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ea580c08_1px,transparent_1px),linear-gradient(to_bottom,#ea580c08_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-orange-600 rounded-full mix-blend-screen filter blur-[120px] opacity-20" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-block mb-4">
            <span className="px-4 py-2 bg-gradient-to-r from-orange-600/20 to-orange-500/20 border border-orange-500/30 rounded-full text-sm font-semibold text-orange-300 backdrop-blur-sm">
              Pricing Plans
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="text-white">Simple, Transparent</span>
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
              Pricing
            </span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Start free, upgrade as you grow. No hidden fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`relative bg-zinc-950 rounded-2xl shadow-lg border-2 p-8 ${
                plan.highlighted
                  ? 'border-orange-500 shadow-2xl shadow-orange-500/30 scale-105'
                  : 'border-orange-500/20'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">
                  {plan.name}
                </h3>
                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-bold text-white">
                    {plan.price}
                  </span>
                  <span className="text-gray-400 ml-2">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <svg
                      className="w-5 h-5 text-orange-500 mr-3 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`block w-full py-3 px-6 rounded-lg font-semibold text-center transition-colors ${
                  plan.highlighted
                    ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white hover:opacity-90 shadow-lg shadow-orange-600/30'
                    : 'bg-zinc-700 text-gray-300 hover:bg-zinc-600 border border-gray-600'
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Enterprise CTA */}
        <div className="mt-16 text-center">
          <div className="relative inline-block max-w-2xl">
            <div className="absolute -inset-2 bg-gradient-to-r from-orange-600 to-orange-500 rounded-3xl blur-2xl opacity-30" />
            <div className="relative bg-zinc-950 rounded-2xl shadow-lg border-2 border-orange-500/30 p-8">
              <h3 className="text-2xl font-bold text-white mb-2">
                Need more? Talk to us about Enterprise
              </h3>
              <p className="text-gray-400 mb-6">
                Custom limits, dedicated infrastructure, and premium support for large organizations.
              </p>
              <Link
                href="/contact"
                className="inline-block px-8 py-3 border-2 border-orange-500 text-orange-400 rounded-lg font-semibold hover:bg-orange-500 hover:text-white transition-all shadow-lg shadow-orange-500/20"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">
            Frequently Asked Questions
          </h3>
          <div className="space-y-4">
            {[
              {
                q: 'Can I change plans later?',
                a: 'Yes, you can upgrade or downgrade at any time. Changes take effect immediately.',
              },
              {
                q: 'What happens if I exceed my storage limit?',
                a: "You'll be notified when you reach 80% of your limit. You can upgrade or optimize your data usage.",
              },
              {
                q: 'Is there a free trial for paid plans?',
                a: 'Yes, all paid plans come with a 14-day free trial. No credit card required.',
              },
            ].map((faq) => (
              <details
                key={faq.q}
                className="bg-zinc-950 rounded-lg border-2 border-orange-500/20 p-4 cursor-pointer hover:border-orange-500/50 transition-colors"
              >
                <summary className="font-semibold text-white">
                  {faq.q}
                </summary>
                <p className="mt-2 text-gray-400">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
