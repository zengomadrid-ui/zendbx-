"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";

interface Member {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  joined_at: string;
  last_active_at: string;
}

interface Message {
  id: string;
  user_id: string;
  sender_name: string;
  sender_email: string;
  content: string;
  created_at: string;
}

export default function TeamPage() {
  const params = useParams();
  const projectId = params.id as string;
  
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch members
  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8000/api/projects/${projectId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (error) {
      console.error("Failed to fetch members:", error);
    }
  };

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8000/api/projects/${projectId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  };

  // Initialize
  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchMembers(), fetchMessages()]);
      setLoading(false);
    };
    
    init();
  }, [projectId]);

  // WebSocket connection
  useEffect(() => {
    const newSocket = io("http://localhost:8001");
    
    newSocket.on("connect", () => {
      console.log("Connected to WebSocket");
      // Join project room
      newSocket.emit("join_project", { project_id: projectId });
    });
    
    newSocket.on("project_joined", (data) => {
      console.log("Joined project:", data);
      setOnlineCount(data.members_online);
    });
    
    newSocket.on("user_joined", (data) => {
      setOnlineCount(data.members_online);
    });
    
    newSocket.on("user_left", (data) => {
      setOnlineCount(data.members_online);
    });
    
    newSocket.on("message_received", (data) => {
      // Refresh messages when new message arrives
      fetchMessages();
    });
    
    // Listen for database changes (realtime triggers)
    newSocket.emit("subscribe", "table:project_messages");
    newSocket.on("db_change", (event) => {
      if (event.table === "project_messages" && event.new?.project_id === projectId) {
        fetchMessages();
      }
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.emit("leave_project", { project_id: projectId });
      newSocket.disconnect();
    };
  }, [projectId]);

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || sending) return;
    
    setSending(true);
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8000/api/projects/${projectId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: newMessage })
      });
      
      if (res.ok) {
        setNewMessage("");
        await fetchMessages();
        messageInputRef.current?.focus();
      } else {
        const error = await res.json();
        alert(error.detail || "Failed to send message");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // Invite member
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteEmail.trim()) return;
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8000/api/projects/${projectId}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      
      if (res.ok) {
        alert("Member invited successfully!");
        setInviteEmail("");
        await fetchMembers();
      } else {
        const error = await res.json();
        alert(error.detail || "Failed to invite member");
      }
    } catch (error) {
      console.error("Failed to invite:", error);
      alert("Failed to invite member");
    }
  };

  // Remove member
  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8000/api/projects/${projectId}/members/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        await fetchMembers();
      } else {
        const error = await res.json();
        alert(error.detail || "Failed to remove member");
      }
    } catch (error) {
      console.error("Failed to remove member:", error);
      alert("Failed to remove member");
    }
  };

  // Update role
  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8000/api/projects/${projectId}/members/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      
      if (res.ok) {
        await fetchMembers();
      } else {
        const error = await res.json();
        alert(error.detail || "Failed to update role");
      }
    } catch (error) {
      console.error("Failed to update role:", error);
      alert("Failed to update role");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold">Team Collaboration</h1>
        <p className="text-gray-400 mt-1">
          {onlineCount > 0 ? `${onlineCount} member${onlineCount !== 1 ? 's' : ''} online` : 'No members online'}
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Members Panel */}
        <div className="w-80 border-r border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold mb-4">Team Members ({members.length})</h2>
            
            {/* Invite Form */}
            <form onSubmit={handleInvite} className="space-y-2">
              <input
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
              />
              <div className="flex gap-2">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                >
                  Invite
                </button>
              </div>
            </form>
          </div>

          {/* Members List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {members.map((member) => (
              <div key={member.id} className="bg-gray-800 rounded p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{member.full_name || "Unknown"}</div>
                    <div className="text-sm text-gray-400 truncate">{member.email}</div>
                    <div className="mt-2">
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.user_id, e.target.value)}
                        className="text-xs px-2 py-1 bg-gray-700 border border-gray-600 rounded"
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(member.user_id)}
                    className="ml-2 text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Panel */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold">Project Chat</h2>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 mt-8">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    {msg.sender_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium">{msg.sender_name || "Unknown"}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-gray-300 mt-1">{msg.content}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-800">
            <div className="flex gap-2">
              <input
                ref={messageInputRef}
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sending}
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
