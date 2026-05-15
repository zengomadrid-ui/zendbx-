'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<'discussions' | 'showcase' | 'resources'>('discussions');

  const discussions = [
    {
      id: 1,
      title: 'How to implement real-time subscriptions?',
      author: 'Sarah Chen',
      avatar: 'SC',
      replies: 12,
      views: 234,
      category: 'Help',
      timestamp: '2 hours ago',
      tags: ['realtime', 'websockets']
    },
    {
      id: 2,
      title: 'Best practices for database schema design',
      author: 'Mike Johnson',
      avatar: 'MJ',
      replies: 8,
      views: 156,
      category: 'Discussion',
      timestamp: '5 hours ago',
      tags: ['database', 'schema']
    },
    {
      id: 3,
      title: 'Sharing my authentication flow implementation',
      author: 'Alex Kumar',
      avatar: 'AK',
      replies: 15,
      views: 342,
      category: 'Showcase',
      timestamp: '1 day ago',
      tags: ['auth', 'tutorial']
    }
  ];

  const showcaseProjects = [
    {
      id: 1,
      title: 'Task Management App',
      description: 'A full-featured task manager built with Zendbx',
      author: 'Emma Wilson',
      avatar: 'EW',
      likes: 45,
      image: '/placeholder-project.jpg',
      tech: ['Next.js', 'Zendbx', 'Tailwind']
    },
    {
      id: 2,
      title: 'E-commerce Platform',
      description: 'Complete e-commerce solution with real-time inventory',
      author: 'David Lee',
      avatar: 'DL',
      likes: 67,
      image: '/placeholder-project.jpg',
      tech: ['React', 'Zendbx', 'Stripe']
    },
    {
      id: 3,
      title: 'Social Media Dashboard',
      description: 'Analytics dashboard for social media management',
      author: 'Lisa Park',
      avatar: 'LP',
      likes: 89,
      image: '/placeholder-project.jpg',
      tech: ['Vue.js', 'Zendbx', 'Chart.js']
    }
  ];

  const resources = [
    {
      id: 1,
      title: 'Getting Started Guide',
      description: 'Complete guide to building your first app',
      type: 'Tutorial',
      duration: '15 min read',
      author: 'Zendbx Team'
    },
    {
      id: 2,
      title: 'Authentication Best Practices',
      description: 'Secure your app with proper auth implementation',
      type: 'Guide',
      duration: '10 min read',
      author: 'Security Team'
    },
    {
      id: 3,
      title: 'Database Optimization Tips',
      description: 'Improve query performance and reduce costs',
      type: 'Tutorial',
      duration: '20 min read',
      author: 'Performance Team'
    }
  ];

  return (
    <div className="min-h-screen bg-[#1c1c1c]">
      {/* Header */}
      <header className="bg-[#181818] border-b border-[#2a2a2a]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-600 to-orange-500 rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">Z</span>
              </div>
              <span className="text-xl font-bold text-white">Zendbx</span>
            </Link>
            <nav className="flex items-center gap-6">
              <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
                Dashboard
              </Link>
              <Link href="/docs" className="text-gray-400 hover:text-white transition-colors">
                Docs
              </Link>
              <Link href="/community" className="text-white font-medium">
                Community
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-[#181818] to-[#1c1c1c] border-b border-[#2a2a2a]">
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            Join the Zendbx Community
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Connect with developers, share your projects, and learn from the community
          </p>
          <div className="flex items-center justify-center gap-4">
            <button className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-semibold hover:from-orange-500 hover:to-orange-600 transition-all">
              Start a Discussion
            </button>
            <button className="px-6 py-3 bg-[#2a2a2a] text-white rounded-lg font-semibold hover:bg-[#3a3a3a] transition-colors">
              Browse Resources
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-[#2a2a2a]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-white mb-2">2.5K+</div>
              <div className="text-sm text-gray-400">Community Members</div>
            </div>
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-white mb-2">450+</div>
              <div className="text-sm text-gray-400">Projects Shared</div>
            </div>
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-white mb-2">1.2K+</div>
              <div className="text-sm text-gray-400">Discussions</div>
            </div>
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-white mb-2">95%</div>
              <div className="text-sm text-gray-400">Response Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        {/* Tabs */}
        <div className="flex items-center gap-4 mb-8 border-b border-[#2a2a2a]">
          <button
            onClick={() => setActiveTab('discussions')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'discussions'
                ? 'text-orange-500 border-orange-500'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Discussions
          </button>
          <button
            onClick={() => setActiveTab('showcase')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'showcase'
                ? 'text-orange-500 border-orange-500'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Showcase
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'resources'
                ? 'text-orange-500 border-orange-500'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Resources
          </button>
        </div>

        {/* Discussions Tab */}
        {activeTab === 'discussions' && (
          <div className="space-y-4">
            {discussions.map((discussion) => (
              <div
                key={discussion.id}
                className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6 hover:border-[#3a3a3a] transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">{discussion.avatar}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-orange-600/20 text-orange-500 text-xs rounded">
                        {discussion.category}
                      </span>
                      {discussion.tags.map((tag) => (
                        <span key={tag} className="px-2 py-1 bg-[#2a2a2a] text-gray-400 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{discussion.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>{discussion.author}</span>
                      <span>•</span>
                      <span>{discussion.replies} replies</span>
                      <span>•</span>
                      <span>{discussion.views} views</span>
                      <span>•</span>
                      <span>{discussion.timestamp}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Showcase Tab */}
        {activeTab === 'showcase' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {showcaseProjects.map((project) => (
              <div
                key={project.id}
                className="bg-[#181818] border border-[#2a2a2a] rounded-lg overflow-hidden hover:border-[#3a3a3a] transition-colors cursor-pointer"
              >
                <div className="h-48 bg-gradient-to-br from-orange-600/20 to-orange-500/20 flex items-center justify-center">
                  <span className="text-6xl text-orange-500/30">📱</span>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-2">{project.title}</h3>
                  <p className="text-sm text-gray-400 mb-4">{project.description}</p>
                  <div className="flex items-center gap-2 mb-4">
                    {project.tech.map((tech) => (
                      <span key={tech} className="px-2 py-1 bg-[#2a2a2a] text-gray-400 text-xs rounded">
                        {tech}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-orange-600 to-orange-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-xs">{project.avatar}</span>
                      </div>
                      <span className="text-sm text-gray-400">{project.author}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                      </svg>
                      <span className="text-sm">{project.likes}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resources Tab */}
        {activeTab === 'resources' && (
          <div className="space-y-4">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6 hover:border-[#3a3a3a] transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-blue-600/20 text-blue-500 text-xs rounded">
                        {resource.type}
                      </span>
                      <span className="text-xs text-gray-400">{resource.duration}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{resource.title}</h3>
                    <p className="text-sm text-gray-400 mb-2">{resource.description}</p>
                    <span className="text-xs text-gray-500">By {resource.author}</span>
                  </div>
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-orange-600 to-orange-500 border-t border-orange-400">
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Build Something Amazing?
          </h2>
          <p className="text-lg text-orange-100 mb-8 max-w-2xl mx-auto">
            Join thousands of developers building the next generation of applications
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-4 bg-white text-orange-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#181818] border-t border-[#2a2a2a]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">© 2024 Zendbx. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/terms" className="text-sm text-gray-400 hover:text-white transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="text-sm text-gray-400 hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/contact" className="text-sm text-gray-400 hover:text-white transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
