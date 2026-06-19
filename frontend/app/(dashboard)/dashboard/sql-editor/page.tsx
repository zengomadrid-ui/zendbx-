'use client';


import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/fetch-utils';

export default function SQLEditorPage() {
  const [sql, setSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [autofixEnabled, setAutofixEnabled] = useState(true); // Auto-fix toggle
  
  // AI Features
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanation, setExplanation] = useState<any>(null);

  // Load autofix preference from localStorage on mount
  useEffect(() => {
    const savedPreference = localStorage.getItem('sql_autofix_enabled');
    if (savedPreference !== null) {
      setAutofixEnabled(savedPreference === 'true');
    }
  }, []);

  // Save autofix preference to localStorage when changed
  useEffect(() => {
    localStorage.setItem('sql_autofix_enabled', autofixEnabled.toString());
  }, [autofixEnabled]);

  // Enhanced SQL Formatting Function for CREATE TABLE statements
  const formatSQL = (sql: string) => {
    if (!sql) return '';
    
    // For CREATE TABLE statements, apply proper formatting
    if (sql.includes('CREATE TABLE')) {
      return sql
        // Add line breaks after CREATE TABLE
        .replace(/CREATE TABLE\s+(\w+)\s*\(/gi, 'CREATE TABLE $1 (\n    ')
        // Add line breaks after each column definition
        .replace(/,\s*(\w+\s+)/g, ',\n    $1')
        // Fix closing parenthesis
        .replace(/\)\s*;/g, '\n);')
        // Clean up extra spaces
        .replace(/\s+/g, ' ')
        // Restore line breaks we added
        .replace(/\n\s*/g, '\n    ')
        // Fix the first line
        .replace(/CREATE TABLE (\w+) \(\n\s+/, 'CREATE TABLE $1 (\n    ')
        // Fix comments
        .replace(/--([^;]+)/g, '\n-- $1\n')
        // Clean up multiple newlines
        .replace(/\n\n+/g, '\n\n')
        .trim();
    }
    
    // For multi-line SQL (like your case), preserve existing formatting if it exists
    if (sql.includes('\n') && sql.length > 200) {
      // This is likely a multi-statement SQL - try to restore formatting
      return sql
        .replace(/;\s*--/g, ';\n\n--')  // Add breaks before comments
        .replace(/CREATE TABLE/gi, '\nCREATE TABLE')  // Break before CREATE TABLE
        .replace(/\(\s*/g, ' (\n    ')  // Format opening parenthesis
        .replace(/,\s*([a-zA-Z_])/g, ',\n    $1')  // Break after commas
        .replace(/\)\s*;/g, '\n);')  // Format closing parenthesis
        .replace(/^\n+/, '')  // Remove leading newlines
        .trim();
    }
    
    // For single-line SQL, apply basic formatting
    return sql
      .replace(/\bSELECT\b/gi, 'SELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bJOIN\b/gi, '\nJOIN')
      .replace(/\bLEFT JOIN\b/gi, '\nLEFT JOIN')
      .replace(/\bRIGHT JOIN\b/gi, '\nRIGHT JOIN')
      .replace(/\bINNER JOIN\b/gi, '\nINNER JOIN')
      .replace(/\bON\b/gi, '\n  ON')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
      .replace(/\bORDER BY\b/gi, '\nORDER BY')
      .replace(/\bHAVING\b/gi, '\nHAVING')
      .replace(/\bLIMIT\b/gi, '\nLIMIT')
      .replace(/\bOFFSET\b/gi, '\nOFFSET')
      .replace(/\bUNION\b/gi, '\nUNION')
      .replace(/\bAND\b/gi, '\n  AND')
      .replace(/\bOR\b/gi, '\n  OR')
      .trim();
  };

  const runQuery = async () => {
    if (!sql.trim()) {
      setError('Please enter a SQL query');
      return;
    }

    const projectId = localStorage.getItem('current_project_id');
    if (!projectId) {
      setError('No project selected. Go to Projects and click Open on a project.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setExplanation(null);
    setShowExplanation(false);

    try {
      const res = await apiFetch(`api/projects/${projectId}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sql,
          enable_autofix: autofixEnabled  // Pass autofix preference
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.detail || 'Query failed';
        setError(errorMsg);
        
        // Only auto-explain if autofix is enabled
        if (autofixEnabled) {
          explainError(errorMsg);
        }
        
        throw new Error(errorMsg);
      }
      setResult(data);
      
      // Notify user if data was modified (INSERT/UPDATE/DELETE)
      const isDataModification = /^\s*(INSERT|UPDATE|DELETE)/i.test(sql.trim());
      if (isDataModification && data.row_count !== undefined) {
        console.log('💡 Data modified successfully. Go to Table Editor and click "Refresh" to see changes.');
      }
    } catch (err: any) {
      // Error already set above
    } finally {
      setLoading(false);
    }
  };

  // AI: Explain SQL Error
  const explainError = async (errorMessage: string) => {
    const projectId = localStorage.getItem('current_project_id');
    if (!projectId || !sql.trim()) return;

    setAiLoading(true);

    try {
      const res = await apiFetch(`api/ai/${projectId}/explain-error`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sql: sql,
          error: errorMessage
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setExplanation({
          explanation: data.explanation,
          problem: data.problem,
          fixed_sql: data.fixed_sql,
          tips: data.tips,
          steps: []
        });
        setShowExplanation(true);
      }
    } catch (err: any) {
      console.error('Failed to explain error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // AI: Natural Language to SQL
  const askAI = async () => {
    if (!aiQuestion.trim()) return;

    const projectId = localStorage.getItem('current_project_id');
    if (!projectId) {
      setError('No project selected');
      return;
    }

    setAiLoading(true);
    setAiResponse(null);

    try {
      const res = await apiFetch(`api/ai/${projectId}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question: aiQuestion,
          model: 'gpt-4'
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'AI query failed');
      
      setAiResponse(data);
      setSql(data.sql); // Auto-fill the SQL editor
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // AI: Explain SQL
  const explainSQL = async () => {
    if (!sql.trim()) return;

    const projectId = localStorage.getItem('current_project_id');
    if (!projectId) return;

    setAiLoading(true);
    setExplanation(null);

    try {
      const res = await apiFetch(`api/ai/${projectId}/explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Explanation failed');
      
      setExplanation(data);
      setShowExplanation(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="h-full flex bg-black">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Header with gradient background */}
        <div className="relative p-6 pb-4 border-b-2 border-orange-500/20 bg-gradient-to-br from-black via-black to-orange-950/20">
          {/* Decorative orange glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">SQL Editor</h1>
              <p className="text-sm text-gray-400">Write queries or ask AI in natural language</p>
            </div>
            
            {/* AI Toggle Button */}
            <button
              onClick={() => setShowAIChat(!showAIChat)}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-lg font-medium transition-all shadow-lg shadow-orange-600/40 hover:shadow-orange-500/50 hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>{showAIChat ? 'Hide' : 'Show'} AI Assistant</span>
            </button>
          </div>

          <div className="relative flex space-x-3">
            <button
              onClick={runQuery}
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50 transition-all shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{loading ? 'Running...' : 'Run Query'}</span>
            </button>
            
            <button
              onClick={explainSQL}
              disabled={!sql.trim() || aiLoading}
              className="flex items-center space-x-2 px-6 py-3 bg-[#1c1c1c] hover:bg-[#2a2a2a] text-white rounded-lg font-medium disabled:opacity-50 transition-all border-2 border-gray-800 hover:border-orange-500/30"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{aiLoading ? 'Explaining...' : 'Explain SQL'}</span>
            </button>

            {/* SQL Autofix Toggle */}
            <div className="flex items-center space-x-2 px-4 py-2 bg-[#1c1c1c] rounded-lg border-2 border-gray-800 hover:border-orange-500/30 transition-all">
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={autofixEnabled}
                    onChange={(e) => setAutofixEnabled(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${
                    autofixEnabled ? 'bg-orange-500' : 'bg-gray-600'
                  }`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                    autofixEnabled ? 'transform translate-x-4' : ''
                  }`}></div>
                </div>
                <div className="ml-3">
                  <span className="text-sm font-medium text-white">Auto-Fix</span>
                  <p className="text-xs text-gray-400">
                    {autofixEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </label>
              
              {/* Info tooltip */}
              <div className="group relative">
                <svg className="w-4 h-4 text-gray-500 hover:text-orange-500 cursor-help transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 z-50">
                  <p className="font-bold mb-1">SQL Auto-Fix</p>
                  <p>When enabled, ZenDBX automatically corrects SQL errors and executes the fixed query. Disable to see raw errors.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Editor Area with enhanced styling */}
        <div className="px-6 py-4 flex-shrink-0">
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            className="w-full h-64 bg-[#0a0a0a] text-white p-5 rounded-lg border-2 border-gray-800 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none shadow-xl"
            placeholder="SELECT * FROM your_table LIMIT 10;&#10;&#10;Or click 'Show AI Assistant' to ask in natural language!"
            style={{
              backgroundImage: 'linear-gradient(to bottom, #0a0a0a 0%, #000000 100%)'
            }}
          />
        </div>

        {/* Autofix Disabled Warning */}
        {!autofixEnabled && (
          <div className="px-6 pb-4">
            <div className="flex items-center space-x-3 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg">
              <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-bold text-yellow-400">Auto-Fix is Disabled</p>
                <p className="text-xs text-yellow-300">SQL errors will not be automatically corrected. You'll see raw error messages.</p>
              </div>
            </div>
          </div>
        )}

        {/* AI Response Preview */}
        {aiResponse && (
          <div className="px-6 pb-4">
            <div className="relative bg-gradient-to-br from-orange-950/40 to-orange-900/20 border-2 border-orange-500/30 rounded-lg p-5 shadow-xl shadow-orange-500/10">
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-orange-400 rounded-lg blur opacity-20"></div>
              
              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-orange-500/20 rounded-lg">
                      <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <span className="text-sm font-bold text-orange-400">AI Generated Query</span>
                  </div>
                  <div className="px-3 py-1 bg-orange-500/20 rounded-full">
                    <span className="text-xs font-semibold text-orange-400">
                      {Math.round(aiResponse.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-300 mb-4">{aiResponse.explanation}</p>
                <div className="bg-black/50 rounded-lg border border-orange-500/20 overflow-hidden">
                  <div className="bg-orange-900/20 px-4 py-2 border-b border-orange-500/20">
                    <span className="text-xs font-medium text-orange-300">Generated SQL Query</span>
                  </div>
                  <div className="p-4 font-mono text-sm">
                    <pre className="text-orange-300 whitespace-pre-wrap leading-relaxed">
                      {formatSQL(aiResponse.sql)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced SQL Explanation Modal */}
        {showExplanation && explanation && (
          <div className="px-6 pb-4">
            <div className="relative bg-gradient-to-br from-gray-900 via-black to-gray-900 border-2 border-orange-500/30 rounded-lg p-6 shadow-2xl shadow-orange-500/10 overflow-hidden">
              {/* Animated background glow */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
              
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/20 rounded-lg">
                      {explanation.fixed_sql ? (
                        <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        {explanation.fixed_sql ? 'Auto-Fix Analysis & Details' : 'Query Explanation'}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {explanation.fixed_sql ? 'Learn how ZenDBX fixed your query' : 'Understanding your SQL query'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowExplanation(false)}
                    className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-all duration-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-6">
                  {/* Main Explanation */}
                  <div className="bg-gradient-to-r from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-lg p-4">
                    <p className="text-gray-200 leading-relaxed">{explanation.explanation}</p>
                  </div>
                  
                  {/* Problem Section */}
                  {explanation.problem && (
                    <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-500/20 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-1 bg-red-500/20 rounded">
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-red-400 mb-1">Problem Identified:</p>
                          <p className="text-sm text-red-300">{explanation.problem}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Before/After Comparison for Auto-Fix */}
                  {explanation.fixed_sql && explanation.original_sql && (
                    <div className="space-y-4">
                      <h4 className="text-lg font-bold text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Before & After Comparison
                      </h4>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Original */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span className="text-sm font-bold text-red-400">Original Query</span>
                          </div>
                          <div className="bg-red-500/10 border border-red-500/20 rounded-lg overflow-hidden">
                            <div className="bg-red-900/20 px-3 py-2 border-b border-red-500/20">
                              <span className="text-xs font-medium text-red-300">Had Errors</span>
                            </div>
                            <div className="p-3 font-mono text-sm max-h-64 overflow-auto">
                              <pre className="text-red-200 whitespace-pre-wrap leading-relaxed text-xs">
                                {formatSQL(explanation.original_sql)}
                              </pre>
                            </div>
                          </div>
                        </div>
                        
                        {/* Fixed */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span className="text-sm font-bold text-green-400">Auto-Fixed Query</span>
                            </div>
                            <button
                              onClick={() => setSql(explanation.fixed_sql)}
                              className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-xs font-medium transition-colors"
                            >
                              ✓ Use This Query
                            </button>
                          </div>
                          <div className="bg-green-500/10 border border-green-500/20 rounded-lg overflow-hidden">
                            <div className="bg-green-900/20 px-3 py-2 border-b border-green-500/20">
                              <span className="text-xs font-medium text-green-300">Executed Successfully</span>
                            </div>
                            <div className="p-3 font-mono text-sm max-h-64 overflow-auto">
                              <pre className="text-green-200 whitespace-pre-wrap leading-relaxed text-xs">
                                {formatSQL(explanation.fixed_sql)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Step-by-Step Breakdown */}
                  {explanation.steps && explanation.steps.length > 0 && (
                    <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Step-by-Step Breakdown:
                      </h4>
                      <div className="space-y-3">
                        {explanation.steps.map((step: string, i: number) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-xs font-bold text-blue-400">{i + 1}</span>
                            </div>
                            <span className="text-sm text-gray-300 leading-relaxed">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Tips & Best Practices */}
                  {explanation.tips && explanation.tips.length > 0 && (
                    <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-purple-400 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Tips & Best Practices:
                      </h4>
                      <div className="space-y-2">
                        {explanation.tips.map((tip: string, i: number) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="text-purple-500 font-bold text-sm mt-1">•</span>
                            <span className="text-sm text-gray-300 leading-relaxed">{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="px-6 pb-4">
            <div className="relative p-5 bg-gradient-to-br from-red-950/40 to-red-900/20 border-2 border-red-500/30 rounded-lg text-red-400 shadow-xl shadow-red-500/10">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-red-400 rounded-lg blur opacity-20"></div>
              <div className="relative flex items-start space-x-3">
                <div className="p-2 bg-red-500/20 rounded-lg flex-shrink-0">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-red-400 mb-1">Error</p>
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {result?.logs && result.logs.length > 0 && (
          <div className="px-6 pb-4">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg text-sm font-medium transition-colors"
            >
              {showLogs ? '🔽 Hide' : '🔼 Show'} Execution Logs ({result.logs.length})
            </button>

            {showLogs && (
              <div className="mt-3 p-4 bg-[#181818] rounded-lg border border-[#2a2a2a] font-mono text-xs space-y-2">
                {result.logs.map((log: any, i: number) => (
                  <div
                    key={i}
                    className={`p-3 rounded ${
                      log.status === 'error'
                        ? 'bg-red-500/10 text-red-500 border border-red-500/50'
                        : 'bg-green-500/10 text-green-500 border border-green-500/50'
                    }`}
                  >
                    <div className="font-bold text-sm">{log.status === 'error' ? 'ERROR' : 'SUCCESS'} {log.status.toUpperCase()}</div>
                    <div className="text-[#a1a1a1] mt-1">{log.message}</div>
                    {log.execution_time_ms && (
                      <div className="text-[#6b6b6b] text-[10px] mt-1">{log.execution_time_ms}ms</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Enhanced Auto-Fix Display - Beautiful before/after comparison */}
        {result && result.auto_fixed && (
          <div className="mx-6 mb-4">
            {/* Success Header */}
            <div className="relative bg-gradient-to-r from-green-500/20 via-blue-500/20 to-purple-500/20 border-2 border-green-500/40 rounded-t-lg p-4 overflow-hidden">
              {/* Animated background glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 via-blue-400/10 to-purple-400/10 animate-pulse"></div>
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-400 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="absolute -inset-1 bg-green-500 rounded-full blur opacity-30 animate-pulse"></div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      SQL Auto-Fixed & Executed Successfully!
                    </h3>
                    <p className="text-sm text-green-300">ZenDBX automatically corrected your query and ran it flawlessly</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-xs text-green-300 font-medium">Execution Time</div>
                    <div className="text-lg font-bold text-green-400">{result.execution_time_ms || 1}ms</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-blue-300 font-medium">Rows Returned</div>
                    <div className="text-lg font-bold text-blue-400">{result.row_count || 0}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Before/After Comparison */}
            <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border-x-2 border-green-500/40 p-6">
              <div className="mb-4 text-center">
                <h4 className="text-sm font-bold text-white mb-1">Before & After Comparison</h4>
                <p className="text-xs text-gray-400">See exactly what ZenDBX fixed for you</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Original SQL - Before */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-sm font-bold text-red-400">Original Query (Had Errors)</span>
                    </div>
                    <div className="px-2 py-1 bg-red-500/20 rounded text-xs text-red-300 font-medium">
                      FAILED
                    </div>
                  </div>
                  
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-red-400 rounded-lg blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
                    <div className="relative bg-red-500/10 border-2 border-red-500/30 rounded-lg overflow-hidden">
                      <div className="bg-red-900/20 px-4 py-2 border-b border-red-500/20">
                        <span className="text-xs font-medium text-red-300">Original Query (Failed)</span>
                      </div>
                      <div className="p-4 font-mono text-sm overflow-auto max-h-64">
                        <pre className="text-red-200 whitespace-pre-wrap leading-relaxed text-xs">
                          {formatSQL(result.original_sql || sql)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Fixed SQL - After */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-bold text-green-400">Auto-Fixed Query</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-2 py-1 bg-green-500/20 rounded text-xs text-green-300 font-medium">
                        SUCCESS
                      </div>
                      <button
                        onClick={() => setSql(result.fixed_sql)}
                        className="px-3 py-1 bg-gradient-to-r from-green-500/20 to-green-600/20 hover:from-green-500/30 hover:to-green-600/30 text-green-400 rounded text-xs font-medium transition-all duration-200 border border-green-500/30 hover:border-green-500/50 hover:scale-105"
                      >
                        Use This SQL
                      </button>
                    </div>
                  </div>
                  
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-green-600 to-green-400 rounded-lg blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
                    <div className="relative bg-green-500/10 border-2 border-green-500/30 rounded-lg overflow-hidden">
                      <div className="bg-green-900/20 px-4 py-2 border-b border-green-500/20 flex items-center justify-between">
                        <span className="text-xs font-medium text-green-300">Auto-Fixed Query (Success)</span>
                        <button
                          onClick={() => setSql(result.fixed_sql)}
                          className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-xs font-medium transition-colors border border-green-500/30"
                        >
                          📝 Use This
                        </button>
                      </div>
                      <div className="p-4 font-mono text-sm overflow-auto max-h-48">
                        <pre className="text-green-200 whitespace-pre-wrap leading-relaxed">
                          {formatSQL(result.fixed_sql)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Diff Highlights */}
              <div className="mt-6 pt-4 border-t border-gray-700">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h5 className="text-sm font-bold text-blue-400 mb-2">What ZenDBX Fixed:</h5>
                    <div className="space-y-2">
                      {(() => {
                        const fixes = [];
                        const original = (result.original_sql || sql).toLowerCase();
                        const fixed = result.fixed_sql.toLowerCase();
                        
                        // Common fixes to detect
                        if (original.includes('user ') && fixed.includes('users ')) {
                          fixes.push('Table name: "user" → "users" (proper pluralization)');
                        }
                        if (original.includes('select *') && !fixed.includes('select *')) {
                          fixes.push('Replaced SELECT * with specific column names for better performance');
                        }
                        if (original.includes('where') !== fixed.includes('where')) {
                          fixes.push('Added/corrected WHERE clause syntax');
                        }
                        if (original.includes(';') !== fixed.includes(';')) {
                          fixes.push('Added proper statement termination');
                        }
                        if (original.replace(/\s+/g, ' ') !== fixed.replace(/\s+/g, ' ')) {
                          fixes.push('Corrected SQL syntax and formatting');
                        }
                        
                        return fixes.length > 0 ? fixes : ['Automatically corrected SQL syntax and table/column names'];
                      })().map((fix, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-orange-500 font-bold text-sm">•</span>
                          <span className="text-sm text-gray-300">{fix}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="bg-gradient-to-r from-gray-900 to-black border-2 border-t-0 border-green-500/40 rounded-b-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>Powered by ZenDBX AI Auto-Fix Engine</span>
                  </div>
                  <div className="text-xs text-green-400 font-medium">
                    Supports 90+ types of SQL errors
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setExplanation({
                      explanation: "Your SQL query was automatically fixed and executed successfully! ZenDBX detected errors in your original query and applied intelligent corrections.",
                      problem: "The original query contained syntax errors, incorrect table/column names, or other issues that prevented execution.",
                      fixed_sql: result.fixed_sql,
                      original_sql: result.original_sql || sql,
                      tips: [
                        "ZenDBX auto-fix uses intelligent pattern matching and schema awareness",
                        "Common fixes include table name corrections (user → users) and syntax improvements",
                        "Review the changes above to learn proper SQL syntax and avoid similar errors",
                        "The auto-fix engine supports 90+ types of common SQL errors and continuously learns",
                        "Your query was executed successfully after automatic correction"
                      ],
                      steps: []
                    });
                    setShowExplanation(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 text-blue-400 rounded-lg text-sm font-medium transition-all duration-200 border border-blue-500/30 hover:border-blue-500/50 hover:scale-105"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Learn More About This Fix</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {result && result.rows && result.rows.length > 0 && (
          <div className="flex-1 overflow-auto px-6 pb-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <span className="text-sm font-semibold text-orange-400">{result.row_count} rows</span>
                </div>
                <div className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                  <span className="text-sm font-semibold text-gray-300">{result.execution_time_ms}ms</span>
                </div>
              </div>
            </div>
            <div className="overflow-auto bg-black rounded-lg border-2 border-gray-800 shadow-2xl">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-gray-900 to-black sticky top-0 border-b-2 border-orange-500/20">
                  <tr>
                    {result.columns?.map((col: string, i: number) => (
                      <th
                        key={i}
                        className="px-5 py-4 text-left text-orange-400 font-bold uppercase text-xs tracking-wider"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows?.map((row: any, i: number) => (
                    <tr
                      key={i}
                      className="border-b border-gray-800 hover:bg-orange-500/5 transition-colors"
                    >
                      {result.columns?.map((col: string, j: number) => (
                        <td key={j} className="px-5 py-4 text-gray-200">
                          {row[col] !== null && row[col] !== undefined ? (
                            String(row[col])
                          ) : (
                            <span className="text-gray-600 italic text-xs">NULL</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && (!result.rows || result.rows.length === 0) && !error && (
          <div className="flex-1 flex items-center justify-center text-[#6b6b6b] px-6 pb-6">
            <div className="text-center">
              <p className="text-lg font-semibold mb-1">Query executed successfully</p>
              <p className="text-sm">No rows returned</p>
            </div>
          </div>
        )}
      </div>

      {/* AI Chat Sidebar */}
      {showAIChat && (
        <div className="w-96 border-l-2 border-orange-500/20 bg-gradient-to-b from-black to-gray-950 flex flex-col shadow-2xl">
          <div className="p-5 border-b-2 border-orange-500/20 bg-gradient-to-r from-black to-orange-950/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-white">AI Assistant</h2>
              </div>
              <button
                onClick={() => setShowAIChat(false)}
                className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-gray-800 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-400">Ask questions in natural language</p>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-4">
            <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-gray-800 rounded-lg p-5 shadow-xl">
              <p className="text-sm font-bold text-orange-400 mb-3 flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Try asking:</span>
              </p>
              <div className="space-y-2">
                {[
                  "Show me all users",
                  "Count total orders by status",
                  "Find users who signed up this month",
                  "Get top 10 products by sales"
                ].map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setAiQuestion(example)}
                    className="w-full text-left px-4 py-3 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white rounded-lg text-xs transition-all border border-gray-800 hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/10"
                  >
                    <span className="text-orange-500 mr-2">→</span>
                    "{example}"
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5 border-t-2 border-orange-500/20 bg-gradient-to-r from-black to-orange-950/20">
            <div className="flex space-x-2">
              <input
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && askAI()}
                placeholder="Ask anything..."
                className="flex-1 px-4 py-3 bg-black border-2 border-gray-800 text-white placeholder-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
              />
              <button
                onClick={askAI}
                disabled={!aiQuestion.trim() || aiLoading}
                className="px-5 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-lg font-medium disabled:opacity-50 transition-all shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105"
              >
                {aiLoading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
