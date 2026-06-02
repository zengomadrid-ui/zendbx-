'use client';


import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getRealtimeWsUrl } from '@/lib/fetch-utils';

interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: string;
  channel: string;
}

interface ConnectionStatus {
  connected: boolean;
  channel: string;
  subscribers: number;
}

export default function RealtimePage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    channel: '',
    subscribers: 0
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [username, setUsername] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('general');
  const [showUsernameModal, setShowUsernameModal] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const channels = ['general', 'users', 'orders', 'notifications'];

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connect to WebSocket
  const connectToWebSocket = () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }

    const newSocket = io(getRealtimeWsUrl(), {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setStatus(prev => ({ ...prev, connected: true }));
      
      // Subscribe to initial channel
      newSocket.emit('subscribe', selectedChannel);
      
      // Add system message
      addSystemMessage(`Connected to server`);
    });

    newSocket.on('subscribed', (data: any) => {
      console.log('Subscribed to channel:', data);
      setStatus(prev => ({ 
        ...prev, 
        channel: data.channel,
        subscribers: data.subscribers 
      }));
      addSystemMessage(`Joined #${data.channel} (${data.subscribers} online)`);
    });

    newSocket.on('subscriber_joined', (data: any) => {
      setStatus(prev => ({ ...prev, subscribers: data.subscribers }));
      addSystemMessage(`Someone joined the channel (${data.subscribers} online)`);
    });

    newSocket.on('subscriber_left', (data: any) => {
      setStatus(prev => ({ ...prev, subscribers: data.subscribers }));
      addSystemMessage(`Someone left the channel (${data.subscribers} online)`);
    });

    newSocket.on('receive_message', (data: any) => {
      console.log('Received message:', data);
      const newMessage: Message = {
        id: Date.now().toString(),
        user: data.user || 'Anonymous',
        text: data.message,
        timestamp: new Date().toLocaleTimeString(),
        channel: data.channel || selectedChannel
      };
      setMessages(prev => [...prev, newMessage]);
    });

    newSocket.on('db_change', (data: any) => {
      console.log('Database change:', data);
      addSystemMessage(`Database updated: ${data.event.table} - ${data.event.action}`);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setStatus(prev => ({ ...prev, connected: false }));
      addSystemMessage('Disconnected from server');
    });

    newSocket.on('error', (error: any) => {
      console.error('WebSocket error:', error);
      addSystemMessage(`Error: ${error.message || 'Connection failed'}`);
    });

    setSocket(newSocket);
    setShowUsernameModal(false);
  };

  // Disconnect
  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setStatus({ connected: false, channel: '', subscribers: 0 });
      setMessages([]);
      setShowUsernameModal(true);
    }
  };

  // Switch channel
  const switchChannel = (channel: string) => {
    if (!socket || !status.connected) return;

    // Unsubscribe from current channel
    if (status.channel) {
      socket.emit('unsubscribe', status.channel);
    }

    // Subscribe to new channel
    socket.emit('subscribe', channel);
    setSelectedChannel(channel);
    setMessages([]);
  };

  // Send message
  const sendMessage = () => {
    if (!socket || !inputMessage.trim() || !status.connected) return;

    socket.emit('send_message', {
      channel: selectedChannel,
      message: inputMessage,
      user: username
    });

    setInputMessage('');
  };

  // Simulate database event
  const simulateDbEvent = () => {
    if (!socket || !status.connected) return;

    socket.emit('db_event', {
      channel: selectedChannel,
      event: {
        table: 'users',
        action: 'INSERT',
        data: { id: Math.floor(Math.random() * 1000), name: 'New User' }
      }
    });
  };

  // Add system message
  const addSystemMessage = (text: string) => {
    const systemMessage: Message = {
      id: Date.now().toString(),
      user: 'System',
      text,
      timestamp: new Date().toLocaleTimeString(),
      channel: selectedChannel
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Real-time WebSocket Demo</h1>
          <p className="text-gray-400">Test live data synchronization across multiple clients</p>
        </div>

        {/* Connection Status Bar */}
        <div className="bg-[#1a1a1a] border-2 border-orange-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${status.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-white font-semibold">
                  {status.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {status.connected && (
                <>
                  <div className="text-gray-400">|</div>
                  <div className="text-orange-400 font-semibold">#{status.channel}</div>
                  <div className="text-gray-400">|</div>
                  <div className="text-gray-400">{status.subscribers} online</div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {!status.connected ? (
                <button
                  onClick={() => setShowUsernameModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-semibold hover:from-orange-500 hover:to-orange-400 transition-all"
                >
                  Connect
                </button>
              ) : (
                <button
                  onClick={disconnect}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-500 transition-all"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Channels Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-[#1a1a1a] border-2 border-orange-500/20 rounded-xl p-4">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
                Channels
              </h3>
              <div className="space-y-2">
                {channels.map((channel) => (
                  <button
                    key={channel}
                    onClick={() => switchChannel(channel)}
                    disabled={!status.connected}
                    className={`w-full text-left px-4 py-2 rounded-lg transition-all ${
                      selectedChannel === channel
                        ? 'bg-orange-500 text-white'
                        : 'bg-[#0a0a0a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    # {channel}
                  </button>
                ))}
              </div>

              {/* Test Actions */}
              <div className="mt-6 pt-6 border-t border-orange-500/20">
                <h4 className="text-white font-semibold mb-3 text-sm">Test Actions</h4>
                <button
                  onClick={simulateDbEvent}
                  disabled={!status.connected}
                  className="w-full px-4 py-2 bg-[#0a0a0a] border border-orange-500/30 text-orange-400 rounded-lg hover:bg-orange-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Simulate DB Event
                </button>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            <div className="bg-[#1a1a1a] border-2 border-orange-500/20 rounded-xl overflow-hidden flex flex-col h-[600px]">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-20">
                    <svg className="w-16 h-16 mx-auto mb-4 text-orange-500/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-lg">No messages yet</p>
                    <p className="text-sm mt-2">Send a message to start the conversation</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.user === 'System' ? 'justify-center' : ''}`}
                    >
                      {msg.user === 'System' ? (
                        <div className="text-center text-gray-500 text-sm italic">
                          {msg.text}
                        </div>
                      ) : (
                        <>
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-orange-600 to-orange-500 flex items-center justify-center text-white font-bold">
                            {msg.user[0].toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-semibold">{msg.user}</span>
                              <span className="text-gray-500 text-xs">{msg.timestamp}</span>
                            </div>
                            <div className="bg-[#0a0a0a] border border-orange-500/20 rounded-lg px-4 py-2 text-gray-300">
                              {msg.text}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t-2 border-orange-500/20 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder={status.connected ? `Message #${selectedChannel}` : 'Connect to send messages'}
                    disabled={!status.connected}
                    className="flex-1 px-4 py-3 bg-[#0a0a0a] border-2 border-orange-500/30 text-white rounded-lg focus:outline-none focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-600"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!status.connected || !inputMessage.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-semibold hover:from-orange-500 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-gradient-to-br from-orange-600/10 to-orange-500/5 border-2 border-orange-500/30 rounded-xl p-6">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to Test Real-time Sync
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
            <div>
              <div className="text-orange-400 font-semibold mb-1">1. Open Multiple Tabs</div>
              <p>Open this page in 2+ browser tabs or windows</p>
            </div>
            <div>
              <div className="text-orange-400 font-semibold mb-1">2. Connect All Clients</div>
              <p>Connect each tab with different usernames</p>
            </div>
            <div>
              <div className="text-orange-400 font-semibold mb-1">3. Send Messages</div>
              <p>Messages appear instantly in all connected tabs!</p>
            </div>
          </div>
        </div>
      </div>

      {/* Username Modal */}
      {showUsernameModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border-2 border-orange-500/30 rounded-xl p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-white mb-4">Enter Your Username</h2>
            <p className="text-gray-400 mb-6">Choose a username to join the real-time chat</p>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && connectToWebSocket()}
              placeholder="Your username"
              className="w-full px-4 py-3 bg-[#0a0a0a] border-2 border-orange-500/30 text-white rounded-lg focus:outline-none focus:border-orange-500 mb-4"
              autoFocus
            />
            <button
              onClick={connectToWebSocket}
              className="w-full px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-semibold hover:from-orange-500 hover:to-orange-400 transition-all"
            >
              Connect to WebSocket
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
