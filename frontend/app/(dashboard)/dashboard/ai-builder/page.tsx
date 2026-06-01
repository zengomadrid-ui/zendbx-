'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/toast';

// Force dynamic rendering - prevent static generation
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface GenerationResult {
  success: boolean;
  description: string;
  plan: {
    backend_type: string;
    tables: Array<{
      name: string;
      description: string;
      enable_auth: boolean;
      enable_realtime: boolean;
    }>;
    features: {
      authentication: boolean;
      realtime: boolean;
    };
  };
  execution: {
    tables_created: string[];
    auth_enabled: string[];
    realtime_enabled: string[];
    errors: string[];
  };
  summary: string;
}

interface Project {
  id: string;
  name: string;
}

const EXAMPLE_PROMPTS = [
  {
    title: "Chat Application",
    description: "Build a real-time chat app backend with users, channels, and messages. Include typing indicators and online status."
  },
  {
    title: "Blog Platform",
    description: "Create a blog platform with posts, comments, likes, and categories. Include author profiles and post drafts."
  },
  {
    title: "Todo App",
    description: "Build a todo app with projects, tasks, subtasks, and tags. Include priority levels and due dates."
  },
  {
    title: "E-commerce",
    description: "Create an e-commerce backend with products, categories, shopping cart, orders, and reviews."
  },
  {
    title: "Social Media",
    description: "Build a social media platform with users, posts, comments, likes, follows, and notifications."
  },
  {
    title: "Event Management",
    description: "Create an event management system with events, attendees, tickets, and check-ins."
  }
];

export default function AIBuilderPage() {
  const { showToast } = useToast();
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await apiClient.get('/api/projects');
      setProjects(response);
      if (response.length > 0 && !selectedProject) {
        setSelectedProject(response[0].id);
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to fetch projects', 'error');
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleGenerate = async () => {
    if (!description.trim()) {
      showToast('Please enter a description', 'error');
      return;
    }

    if (!selectedProject) {
      showToast('Please select a project', 'error');
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const response = await apiClient.post(
        `/api/ai/${selectedProject}/generate-backend`,
        { description }
      );

      setResult(response);
      showToast('Backend generated successfully!', 'success');
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to generate backend';
      
      // Check if it's a rate limit error
      if (errorMsg.includes('rate limit') || errorMsg.includes('Rate limit')) {
        showToast(
          'Groq API rate limit reached. Please wait 30 seconds and try again, or upgrade your Groq plan for higher limits.',
          'error'
        );
      } else if (errorMsg.includes('429')) {
        showToast(
          'Too many requests. Please wait a moment and try again.',
          'error'
        );
      } else {
        showToast(errorMsg, 'error');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const useExample = (example: typeof EXAMPLE_PROMPTS[0]) => {
    setDescription(example.description);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl font-semibold text-[#ededed]">AI Backend Builder</h1>
        </div>
        <p className="text-xs text-[#a1a1a1]">
          Describe your backend in plain English, and AI will build it for you.
          Creates tables, relationships, auth, realtime, and more!
        </p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Input */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Selection */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
            <label className="block text-xs font-medium text-[#ededed] mb-2">
              Select Project
            </label>
            {loadingProjects ? (
              <div className="px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-xs text-[#6b6b6b]">
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-xs text-[#6b6b6b]">
                No projects found. Create a project first.
              </div>
            ) : (
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full bg-[#1c1c1c] border border-[#2a2a2a] rounded px-3 py-2 text-xs text-[#ededed] focus:outline-none focus:border-orange-600"
              >
                <option value="">Choose a project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Description Input */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
            <label className="block text-xs font-medium text-[#ededed] mb-2">
              Describe Your Backend
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Example: Build a chat app backend with users, channels, and messages. Include real-time updates and user authentication."
              className="w-full h-32 bg-[#1c1c1c] border border-[#2a2a2a] rounded px-3 py-2 text-xs text-[#ededed] placeholder-[#6b6b6b] focus:outline-none focus:border-orange-600 resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-[#6b6b6b]">
                {description.length} characters
              </span>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !description.trim() || !selectedProject}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-[#2a2a2a] disabled:cursor-not-allowed text-white rounded text-xs font-medium transition-colors flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Backend'
                )}
              </button>
            </div>
          </div>

          {/* Result Display */}
          {result && (
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
              <h2 className="text-sm font-semibold text-[#ededed] mb-3 flex items-center gap-2">
                Generation Result
              </h2>

              {/* Summary */}
              <div className="bg-[#1c1c1c] rounded p-3 mb-4">
                <pre className="text-green-500 whitespace-pre-wrap font-mono text-[10px]">
                  {result.summary}
                </pre>
              </div>

              {/* Detailed Plan - Tables with Columns */}
              {result.plan && result.plan.tables && result.plan.tables.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-[#ededed] mb-3">
                    Tables & Schema
                  </h3>
                  <div className="space-y-3">
                    {result.plan.tables.map((table: any, idx: number) => (
                      <div key={idx} className="bg-[#1c1c1c] rounded p-3 border border-[#2a2a2a]">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold text-orange-500">
                            {table.name}
                          </h4>
                          <div className="flex gap-2">
                            {table.enable_auth && (
                              <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                Auth
                              </span>
                            )}
                            {table.enable_realtime && (
                              <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                                Realtime
                              </span>
                            )}
                          </div>
                        </div>
                        {table.description && (
                          <p className="text-[10px] text-[#a1a1a1] mb-2">
                            {table.description}
                          </p>
                        )}
                        <div className="space-y-1">
                          <div className="text-[10px] font-semibold text-[#ededed] mb-1">
                            Columns:
                          </div>
                          {table.columns && table.columns.map((col: any, colIdx: number) => (
                            <div key={colIdx} className="text-[10px] text-[#a1a1a1] pl-2 flex items-center gap-2">
                              <span className="text-orange-400">{col.name}</span>
                              <span className="text-[#6b6b6b]">:</span>
                              <span className="text-blue-400">{col.type}</span>
                              {col.primary_key && (
                                <span className="text-[10px] px-1 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                                  PK
                                </span>
                              )}
                              {!col.nullable && (
                                <span className="text-[10px] text-red-400">NOT NULL</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tables Created */}
              {result.execution.tables_created.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-[#ededed] mb-2">
                    Tables Created
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {result.execution.tables_created.map((table) => (
                      <div
                        key={table}
                        className="bg-[#1c1c1c] rounded px-2 py-1.5 text-[10px] text-[#a1a1a1]"
                      >
                        {table}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Features Enabled */}
              <div className="grid grid-cols-2 gap-4">
                {result.execution.auth_enabled.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-semibold text-[#ededed] mb-2">
                      Auth Enabled
                    </h3>
                    <div className="space-y-1">
                      {result.execution.auth_enabled.map((table) => (
                        <div key={table} className="text-[10px] text-[#a1a1a1]">
                          • {table}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.execution.realtime_enabled.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-semibold text-[#ededed] mb-2">
                      Realtime Enabled
                    </h3>
                    <div className="space-y-1">
                      {result.execution.realtime_enabled.map((table) => (
                        <div key={table} className="text-[10px] text-[#a1a1a1]">
                          • {table}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Errors */}
              {result.execution.errors.length > 0 && (
                <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded p-3">
                  <h3 className="text-[10px] font-semibold text-red-400 mb-2">
                    Warnings
                  </h3>
                  <div className="space-y-1">
                    {result.execution.errors.map((error, idx) => (
                      <div key={idx} className="text-[10px] text-red-300">
                        • {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Steps */}
              <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded p-3">
                <h3 className="text-[10px] font-semibold text-blue-400 mb-2">
                  Next Steps
                </h3>
                <ul className="space-y-1 text-[10px] text-blue-300">
                  <li>• View your tables in the Database section</li>
                  <li>• Test the API in the API Playground</li>
                  <li>• Check realtime updates in the Realtime section</li>
                  <li>• Configure RLS policies for security</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Examples */}
        <div className="space-y-6">
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
            <h2 className="text-sm font-semibold text-[#ededed] mb-3">
              Example Prompts
            </h2>
            <div className="space-y-2">
              {EXAMPLE_PROMPTS.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => useExample(example)}
                  className="w-full text-left bg-[#1c1c1c] hover:bg-[#2a2a2a] rounded p-3 transition-colors border border-[#2a2a2a] hover:border-orange-600"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-[#ededed] text-xs mb-1">
                        {example.title}
                      </h3>
                      <p className="text-[10px] text-[#a1a1a1] line-clamp-2">
                        {example.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Features Info */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
            <h2 className="text-sm font-semibold text-[#ededed] mb-3">
              What Gets Created
            </h2>
            <ul className="space-y-2 text-[10px] text-[#a1a1a1]">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Database tables with proper types</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Foreign key relationships</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Authentication & RLS policies</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Real-time subscriptions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Performance indexes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>REST API endpoints</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
