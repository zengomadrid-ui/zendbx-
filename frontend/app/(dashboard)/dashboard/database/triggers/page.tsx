"use client";

import { useState, useEffect } from "react";

interface Trigger {
  name: string;
  table_name: string;
  function_name: string;
  timing: string;
  event: string;
}

interface DBFunction {
  name: string;
  arguments: string;
  return_type: string;
}

interface Table {
  table_name: string;
  columns: any[];
}

export default function TriggersPage() {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [functions, setFunctions] = useState<DBFunction[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTrigger, setSelectedTrigger] = useState<Trigger | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTrigger, setNewTrigger] = useState({
    trigger_name: "",
    table_name: "",
    event: "INSERT",
    function_name: "",
    timing: "AFTER"
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const projectId = localStorage.getItem("current_project_id");
      const token = localStorage.getItem("token");
      const headers = {
        "Authorization": `Bearer ${token}`,
        "x-project-id": projectId || ""
      };

      const [triggersRes, functionsRes, tablesRes] = await Promise.all([
        fetch(`http://localhost:8000/api/projects/${projectId}/db/triggers`, { headers }),
        fetch(`http://localhost:8000/api/projects/${projectId}/db/functions`, { headers }),
        fetch(`http://localhost:8000/api/projects/${projectId}/db/tables`, { headers })
      ]);

      if (triggersRes.ok) {
        const data = await triggersRes.json();
        setTriggers(data.triggers || []);
        if (data.triggers?.length > 0 && !selectedTrigger) {
          setSelectedTrigger(data.triggers[0]);
        }
      }
      if (functionsRes.ok) {
        const data = await functionsRes.json();
        setFunctions(data.functions || []);
      }
      if (tablesRes.ok) {
        const data = await tablesRes.json();
        setTables(data.tables || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const createTrigger = async () => {
    try {
      const projectId = localStorage.getItem("current_project_id");
      const token = localStorage.getItem("token");
      
      const response = await fetch(`http://localhost:8000/api/projects/${projectId}/db/triggers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-project-id": projectId || ""
        },
        body: JSON.stringify(newTrigger)
      });
      
      if (response.ok) {
        setShowCreateModal(false);
        setNewTrigger({
          trigger_name: "",
          table_name: "",
          event: "INSERT",
          function_name: "",
          timing: "AFTER"
        });
        fetchData();
      } else {
        const error = await response.json();
        alert(`Failed to create trigger: ${error.detail}`);
      }
    } catch (error) {
      console.error("Failed to create trigger:", error);
      alert("Failed to create trigger. Check console for details.");
    }
  };

  const deleteTrigger = async (triggerName: string, tableName: string) => {
    if (!confirm(`Delete trigger "${triggerName}"? This action cannot be undone.`)) return;
    
    try {
      const projectId = localStorage.getItem("current_project_id");
      const token = localStorage.getItem("token");
      
      const response = await fetch(
        `http://localhost:8000/api/projects/${projectId}/db/triggers/${triggerName}?table_name=${tableName}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`,
            "x-project-id": projectId || ""
          }
        }
      );
      
      if (response.ok) {
        if (selectedTrigger?.name === triggerName) {
          setSelectedTrigger(null);
        }
        fetchData();
      }
    } catch (error) {
      console.error("Failed to delete trigger:", error);
    }
  };

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'INSERT':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        );
      case 'UPDATE':
        return (
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      case 'DELETE':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1c1c1c]">
        <div className="text-[#a1a1a1]">Loading triggers...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-[#1c1c1c]">
      {/* Sidebar - Triggers List */}
      <div className="w-64 bg-[#181818] border-r border-[#2a2a2a] flex flex-col">
        <div className="p-4 border-b border-[#2a2a2a]">
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={functions.length === 0 || tables.length === 0}
            className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Trigger
          </button>
          {(functions.length === 0 || tables.length === 0) && (
            <p className="text-xs text-[#6b6b6b] mt-2 text-center">
              Need tables & functions first
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {triggers.length === 0 ? (
            <div className="p-4 text-center text-[#6b6b6b] text-sm">
              No triggers yet
            </div>
          ) : (
            <div className="space-y-1">
              {triggers.map((trigger) => (
                <button
                  key={trigger.name}
                  onClick={() => setSelectedTrigger(trigger)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedTrigger?.name === trigger.name
                      ? "bg-[#2a2a2a] text-[#ededed]"
                      : "text-[#a1a1a1] hover:bg-[#2a2a2a] hover:text-[#ededed]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {getEventIcon(trigger.event)}
                    <span className="truncate">{trigger.name}</span>
                  </div>
                  <div className="text-xs text-[#6b6b6b] mt-1 truncate">
                    {trigger.timing} {trigger.event} on {trigger.table_name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Trigger Details */}
      <div className="flex-1 flex flex-col">
        {selectedTrigger ? (
          <>
            {/* Header */}
            <div className="bg-[#181818] border-b border-[#2a2a2a] px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-[#ededed]">{selectedTrigger.name}</h1>
                  <p className="text-sm text-[#6b6b6b] mt-1">
                    {selectedTrigger.timing} {selectedTrigger.event} on {selectedTrigger.table_name}
                  </p>
                </div>
                <button
                  onClick={() => deleteTrigger(selectedTrigger.name, selectedTrigger.table_name)}
                  className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 text-sm rounded transition-colors"
                >
                  Delete Trigger
                </button>
              </div>
            </div>

            {/* Trigger Details */}
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-4xl space-y-6">
                {/* Configuration Card */}
                <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg overflow-hidden">
                  <div className="bg-[#1c1c1c] px-4 py-3 border-b border-[#2a2a2a]">
                    <h3 className="text-sm font-medium text-[#ededed]">Configuration</h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-medium text-[#a1a1a1] uppercase mb-2">
                          Table
                        </label>
                        <div className="flex items-center gap-2 px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded">
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm text-[#ededed]">{selectedTrigger.table_name}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#a1a1a1] uppercase mb-2">
                          Function
                        </label>
                        <div className="flex items-center gap-2 px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded">
                          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          <span className="text-sm text-[#ededed]">{selectedTrigger.function_name}()</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#a1a1a1] uppercase mb-2">
                          Event
                        </label>
                        <div className="flex items-center gap-2 px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded">
                          {getEventIcon(selectedTrigger.event)}
                          <span className="text-sm text-[#ededed]">{selectedTrigger.event}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#a1a1a1] uppercase mb-2">
                          Timing
                        </label>
                        <div className="px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded">
                          <span className="text-sm text-[#ededed]">{selectedTrigger.timing}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SQL Preview */}
                <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg overflow-hidden">
                  <div className="bg-[#1c1c1c] px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
                    <h3 className="text-sm font-medium text-[#ededed]">SQL Definition</h3>
                    <button
                      onClick={() => {
                        const sql = `CREATE TRIGGER ${selectedTrigger.name}
${selectedTrigger.timing} ${selectedTrigger.event} ON ${selectedTrigger.table_name}
FOR EACH ROW
EXECUTE FUNCTION ${selectedTrigger.function_name}();`;
                        navigator.clipboard.writeText(sql);
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
                  <div className="p-4">
                    <pre className="text-sm text-[#ededed] font-mono leading-relaxed">
{`CREATE TRIGGER ${selectedTrigger.name}
${selectedTrigger.timing} ${selectedTrigger.event} ON ${selectedTrigger.table_name}
FOR EACH ROW
EXECUTE FUNCTION ${selectedTrigger.function_name}();`}
                    </pre>
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-4">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-medium text-blue-400 mb-1">How Triggers Work</h4>
                      <p className="text-xs text-blue-300/80 leading-relaxed">
                        This trigger automatically executes the <span className="font-mono">{selectedTrigger.function_name}()</span> function 
                        {selectedTrigger.timing === 'BEFORE' ? ' before' : ' after'} any {selectedTrigger.event.toLowerCase()} operation 
                        on the <span className="font-mono">{selectedTrigger.table_name}</span> table.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto text-[#3a3a3a] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="text-lg font-medium text-[#ededed] mb-2">No trigger selected</h3>
              <p className="text-sm text-[#6b6b6b]">
                Select a trigger from the sidebar or create a new one
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create Trigger Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#ededed]">Create New Trigger</h2>
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
                    Trigger Name
                  </label>
                  <input
                    type="text"
                    value={newTrigger.trigger_name}
                    onChange={(e) => setNewTrigger({ ...newTrigger, trigger_name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-[#ededed] placeholder-[#6b6b6b] focus:outline-none focus:border-green-600"
                    placeholder="on_user_created"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#ededed] mb-2">
                      Table
                    </label>
                    <select
                      value={newTrigger.table_name}
                      onChange={(e) => setNewTrigger({ ...newTrigger, table_name: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-[#ededed] focus:outline-none focus:border-green-600"
                    >
                      <option value="">Select table...</option>
                      {tables.map((table) => (
                        <option key={table.table_name} value={table.table_name}>
                          {table.table_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#ededed] mb-2">
                      Event
                    </label>
                    <select
                      value={newTrigger.event}
                      onChange={(e) => setNewTrigger({ ...newTrigger, event: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-[#ededed] focus:outline-none focus:border-green-600"
                    >
                      <option value="INSERT">INSERT</option>
                      <option value="UPDATE">UPDATE</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#ededed] mb-2">
                      Timing
                    </label>
                    <select
                      value={newTrigger.timing}
                      onChange={(e) => setNewTrigger({ ...newTrigger, timing: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-[#ededed] focus:outline-none focus:border-green-600"
                    >
                      <option value="BEFORE">BEFORE</option>
                      <option value="AFTER">AFTER</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#ededed] mb-2">
                      Function
                    </label>
                    <select
                      value={newTrigger.function_name}
                      onChange={(e) => setNewTrigger({ ...newTrigger, function_name: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-[#ededed] focus:outline-none focus:border-green-600"
                    >
                      <option value="">Select function...</option>
                      {functions.map((func) => (
                        <option key={func.name} value={func.name}>
                          {func.name}()
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Preview */}
                {newTrigger.trigger_name && newTrigger.table_name && newTrigger.function_name && (
                  <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
                    <div className="text-xs font-medium text-[#a1a1a1] uppercase mb-2">SQL Preview</div>
                    <pre className="text-xs text-[#ededed] font-mono leading-relaxed">
{`CREATE TRIGGER ${newTrigger.trigger_name}
${newTrigger.timing} ${newTrigger.event} ON ${newTrigger.table_name}
FOR EACH ROW
EXECUTE FUNCTION ${newTrigger.function_name}();`}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[#2a2a2a] flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] text-sm rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createTrigger}
                disabled={!newTrigger.trigger_name || !newTrigger.table_name || !newTrigger.function_name}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Trigger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
