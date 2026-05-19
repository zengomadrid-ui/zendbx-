"use client";

import { useState, useEffect } from "react";

interface DBFunction {
  name: string;
  definition: string;
  arguments: string;
  return_type: string;
}

export default function FunctionsPage() {
  const [functions, setFunctions] = useState<DBFunction[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<DBFunction | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [functionSQL, setFunctionSQL] = useState(`CREATE OR REPLACE FUNCTION my_function()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Your function logic here
  RAISE NOTICE 'Function executed';
END;
$$;`);

  useEffect(() => {
    fetchFunctions();
  }, []);

  const fetchFunctions = async () => {
    try {
      const projectId = localStorage.getItem("current_project_id");
      const token = localStorage.getItem("token");
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/projects/${projectId}/db/functions`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-project-id": projectId || ""
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setFunctions(data.functions || []);
        if (data.functions?.length > 0 && !selectedFunction) {
          setSelectedFunction(data.functions[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch functions:", error);
    } finally {
      setLoading(false);
    }
  };

  const createFunction = async () => {
    try {
      const projectId = localStorage.getItem("current_project_id");
      const token = localStorage.getItem("token");
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/projects/${projectId}/db/functions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-project-id": projectId || ""
        },
        body: JSON.stringify({ function_sql: functionSQL })
      });
      
      if (response.ok) {
        setShowCreateModal(false);
        setFunctionSQL(`CREATE OR REPLACE FUNCTION my_function()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Your function logic here
  RAISE NOTICE 'Function executed';
END;
$$;`);
        fetchFunctions();
      } else {
        const error = await response.json();
        alert(`Failed to create function: ${error.detail}`);
      }
    } catch (error) {
      console.error("Failed to create function:", error);
      alert("Failed to create function. Check console for details.");
    }
  };

  const deleteFunction = async (functionName: string) => {
    if (!confirm(`Delete function "${functionName}"? This action cannot be undone.`)) return;
    
    try {
      const projectId = localStorage.getItem("current_project_id");
      const token = localStorage.getItem("token");
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/projects/${projectId}/db/functions/${functionName}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-project-id": projectId || ""
        }
      });
      
      if (response.ok) {
        if (selectedFunction?.name === functionName) {
          setSelectedFunction(null);
        }
        fetchFunctions();
      }
    } catch (error) {
      console.error("Failed to delete function:", error);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1c1c1c]">
        <div className="text-[#a1a1a1]">Loading functions...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-[#1c1c1c]">
      {/* Sidebar - Functions List */}
      <div className="w-64 bg-[#181818] border-r border-[#2a2a2a] flex flex-col">
        <div className="p-4 border-b border-[#2a2a2a]">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Function
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {functions.length === 0 ? (
            <div className="p-4 text-center text-[#6b6b6b] text-sm">
              No functions yet
            </div>
          ) : (
            <div className="space-y-1">
              {functions.map((func) => (
                <button
                  key={func.name}
                  onClick={() => setSelectedFunction(func)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedFunction?.name === func.name
                      ? "bg-[#2a2a2a] text-[#ededed]"
                      : "text-[#a1a1a1] hover:bg-[#2a2a2a] hover:text-[#ededed]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <span className="truncate">{func.name}</span>
                  </div>
                  <div className="text-xs text-[#6b6b6b] mt-1 truncate">
                    {func.arguments || "no args"} → {func.return_type}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Function Details */}
      <div className="flex-1 flex flex-col">
        {selectedFunction ? (
          <>
            {/* Header */}
            <div className="bg-[#181818] border-b border-[#2a2a2a] px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-[#ededed]">{selectedFunction.name}</h1>
                  <p className="text-sm text-[#6b6b6b] mt-1">
                    Arguments: {selectedFunction.arguments || "none"} • Returns: {selectedFunction.return_type}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] text-sm rounded transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => deleteFunction(selectedFunction.name)}
                    className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 text-sm rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            {/* Function Definition */}
            <div className="flex-1 overflow-auto p-6">
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg overflow-hidden">
                <div className="bg-[#1c1c1c] px-4 py-2 border-b border-[#2a2a2a] flex items-center justify-between">
                  <span className="text-xs font-medium text-[#a1a1a1] uppercase">Definition</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedFunction.definition);
                      alert("Copied to clipboard!");
                    }}
                    className="text-xs text-[#6b6b6b] hover:text-[#ededed] transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </button>
                </div>
                <div className="p-4 overflow-x-auto">
                  <pre className="text-sm text-[#ededed] font-mono leading-relaxed">
                    {selectedFunction.definition}
                  </pre>
                </div>
              </div>

              {/* Function Info Cards */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
                  <div className="text-xs font-medium text-[#a1a1a1] uppercase mb-2">Arguments</div>
                  <div className="text-sm text-[#ededed] font-mono">
                    {selectedFunction.arguments || <span className="text-[#6b6b6b]">No arguments</span>}
                  </div>
                </div>
                <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
                  <div className="text-xs font-medium text-[#a1a1a1] uppercase mb-2">Return Type</div>
                  <div className="text-sm text-[#ededed] font-mono">
                    {selectedFunction.return_type}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto text-[#3a3a3a] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <h3 className="text-lg font-medium text-[#ededed] mb-2">No function selected</h3>
              <p className="text-sm text-[#6b6b6b]">
                Select a function from the sidebar or create a new one
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create Function Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#ededed]">Create New Function</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#6b6b6b] hover:text-[#ededed] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#ededed] mb-2">
                    Function SQL
                  </label>
                  <div className="text-xs text-[#6b6b6b] mb-2">
                    Write your PL/pgSQL function definition below
                  </div>
                  <textarea
                    value={functionSQL}
                    onChange={(e) => setFunctionSQL(e.target.value)}
                    className="w-full h-96 px-4 py-3 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-[#ededed] font-mono text-sm placeholder-[#6b6b6b] focus:outline-none focus:border-green-600 resize-none"
                    placeholder="CREATE OR REPLACE FUNCTION..."
                    spellCheck={false}
                  />
                </div>

                {/* Template Examples */}
                <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
                  <div className="text-xs font-medium text-[#a1a1a1] uppercase mb-3">Quick Templates</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setFunctionSQL(`CREATE OR REPLACE FUNCTION hello_world()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'Hello, World!';
END;
$$;`)}
                      className="px-3 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] text-xs rounded transition-colors text-left"
                    >
                      Simple Function
                    </button>
                    <button
                      onClick={() => setFunctionSQL(`CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;`)}
                      className="px-3 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] text-xs rounded transition-colors text-left"
                    >
                      Trigger Function
                    </button>
                    <button
                      onClick={() => setFunctionSQL(`CREATE OR REPLACE FUNCTION get_user_count()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
  RETURN user_count;
END;
$$;`)}
                      className="px-3 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] text-xs rounded transition-colors text-left"
                    >
                      Count Function
                    </button>
                    <button
                      onClick={() => setFunctionSQL(`CREATE OR REPLACE FUNCTION add_numbers(a integer, b integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN a + b;
END;
$$;`)}
                      className="px-3 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] text-xs rounded transition-colors text-left"
                    >
                      With Parameters
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[#2a2a2a] flex justify-between items-center">
              <div className="text-xs text-[#6b6b6b]">
                Tip: Use PL/pgSQL for complex logic and better performance
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] text-sm rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createFunction}
                  disabled={!functionSQL.trim()}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Function
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
