'use client';

import { motion } from 'framer-motion';

const testimonials = [
  {
    quote: "Nexora saved our team 10 hours per week. We no longer wait for the data team to write queries for us.",
    author: "Sarah Mitchell",
    role: "Senior Analyst",
    company: "TechCorp",
    avatar: "SM",
  },
  {
    quote: "The AI query engine is incredibly accurate. It understands complex questions and generates perfect SQL every time.",
    author: "Mike Thompson",
    role: "Product Manager",
    company: "DataFlow Inc",
    avatar: "MT",
  },
  {
    quote: "We integrated Nexora's API into our internal tools. Now our entire team can query data without SQL knowledge.",
    author: "Elena Rodriguez",
    role: "Engineering Lead",
    company: "FinanceHub",
    avatar: "ER",
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 bg-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            What Our Users Say
          </h2>
          <p className="text-xl text-gray-400">
            Join thousands of happy data teams
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-zinc-900 rounded-xl p-8 border border-gray-700 hover:shadow-lg hover:shadow-orange-600/10 transition-shadow hover:border-orange-600/50"
            >
              {/* Stars */}
              <div className="flex space-x-1 mb-4">
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

              {/* Quote */}
              <p className="text-gray-300 mb-6 leading-relaxed">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-500 rounded-full flex items-center justify-center text-white font-bold mr-4 shadow-lg shadow-orange-600/50">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-white">
                    {testimonial.author}
                  </div>
                  <div className="text-sm text-gray-400">
                    {testimonial.role} at {testimonial.company}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
