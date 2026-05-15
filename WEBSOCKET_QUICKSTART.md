# WebSocket Server - Quick Start Guide

## 🎯 What We Built

A complete WebSocket server for real-time communication in Zendbx with:
- ✅ Connection handling
- ✅ Channel-based pub/sub system
- ✅ Message broadcasting
- ✅ Database event simulation
- ✅ HTML test client
- ✅ Health monitoring

## 🚀 Getting Started (3 Steps)

### Step 1: Install Dependencies

```bash
cd websocket-server
npm install
```

This installs:
- `express` - Web server
- `socket.io` - WebSocket library
- `cors` - Cross-origin support
- `dotenv` - Environment config
- `nodemon` - Auto-reload (dev)

### Step 2: Start the Server

**Option A: Using the batch file (Windows)**
```bash
start.bat
```

**Option B: Using npm**
```bash
npm run dev
```

You should see:
```
🚀 Zendbx WebSocket Server started successfully
📡 Server running on port 8001
🔗 WebSocket endpoint: ws://localhost:8001
💚 Health check: http://localhost:8001/health
📊 Stats: http://localhost:8001/stats
```

### Step 3: Test It!

**Option A: HTML Test Client (Easiest)**

1. Open `test/test-client.html` in your browser
2. Click "Connect"
3. Subscribe to "users" channel
4. Send a test message
5. See it appear in the log!

**Option B: Command Line**

```bash
# Check if server is running
curl http://localhost:8001/health

# Get statistics
curl http://localhost:8001/stats
```

## 🧪 Testing Scenarios

### Test 1: Basic Connection ✅

1. Open test client
2. Click "Connect"
3. You should see: "Connected with socket ID: xxx"

### Test 2: Channel Subscription ✅

1. Type "users" in the channel field
2. Click "Subscribe"
3. You should see: "Subscribed to 'users' (1 subscribers)"

### Test 3: Send Message ✅

1. Make sure you're subscribed to "users"
2. Type a message
3. Click "Send Message"
4. You should see your message in the log!

### Test 4: Multiple Clients ✅

1. Open test client in 2 browser tabs
2. Connect both
3. Subscribe both to "users"
4. Send message from Tab 1
5. Both tabs should receive it!

### Test 5: Channel Isolation ✅

1. Tab 1: Subscribe to "users"
2. Tab 2: Subscribe to "posts"
3. Send message to "users"
4. Only Tab 1 receives it ✓

### Test 6: Database Events ✅

1. Subscribe to a channel
2. Click "Send DB Event"
3. You should see: "DB Event: INSERT on users"

## 📊 What Each File Does

```
websocket-server/
├── server.js              ← Main server (starts everything)
├── package.json           ← Dependencies list
├── .env                   ← Configuration (port, CORS, etc.)
│
├── config/
│   └── config.js         ← Loads environment variables
│
├── handlers/
│   ├── connection.js     ← Handles connect/disconnect
│   ├── subscription.js   ← Handles subscribe/unsubscribe
│   └── broadcast.js      ← Handles message sending
│
├── utils/
│   ├── logger.js         ← Logging utility
│   └── channels.js       ← Tracks channel subscriptions
│
└── test/
    └── test-client.html  ← Visual test client
```

## 🎮 How to Use

### From JavaScript/TypeScript

```javascript
// Connect
const socket = io('http://localhost:8001');

// Subscribe to channel
socket.emit('subscribe', 'users');

// Listen for messages
socket.on('receive_message', (data) => {
  console.log('Message:', data.message);
});

// Send message
socket.emit('send_message', {
  channel: 'users',
  message: 'Hello!'
});
```

### From React (Next.js)

```typescript
'use client';

import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export default function RealtimeComponent() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const newSocket = io('http://localhost:8001');
    
    newSocket.on('connect', () => {
      console.log('Connected!');
      newSocket.emit('subscribe', 'users');
    });
    
    newSocket.on('receive_message', (data) => {
      setMessages(prev => [...prev, data.message]);
    });
    
    setSocket(newSocket);
    
    return () => newSocket.close();
  }, []);

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg}</div>
      ))}
    </div>
  );
}
```

## 🔧 Configuration

Edit `.env` to change settings:

```env
PORT=8001              # Server port
CORS_ORIGIN=*          # Allow all origins (dev only!)
LOG_LEVEL=info         # error, warn, info, debug
```

## 📡 API Endpoints

### Health Check
```bash
GET http://localhost:8001/health
```
Returns server status and connection count

### Statistics
```bash
GET http://localhost:8001/stats
```
Returns active connections and channels

### Channels
```bash
GET http://localhost:8001/channels
```
Returns list of active channels with subscriber counts

## 🎯 WebSocket Events Reference

### Subscribe to Channel
```javascript
socket.emit('subscribe', 'channel-name');
```

### Unsubscribe from Channel
```javascript
socket.emit('unsubscribe', 'channel-name');
```

### Send Message
```javascript
socket.emit('send_message', {
  channel: 'channel-name',
  message: { any: 'data' }
});
```

### Receive Message
```javascript
socket.on('receive_message', (data) => {
  console.log(data.channel);  // Channel name
  console.log(data.message);  // Your message
  console.log(data.from);     // Sender socket ID
});
```

### Database Event (for testing)
```javascript
socket.emit('db_event', {
  channel: 'users',
  event: {
    type: 'INSERT',      // INSERT, UPDATE, DELETE
    table: 'users',
    schema: 'public',
    new: { id: 1, name: 'John' }
  }
});
```

### Listen for DB Changes
```javascript
socket.on('db_change', (data) => {
  console.log(data.event.type);   // INSERT, UPDATE, DELETE
  console.log(data.event.table);  // Table name
  console.log(data.event.new);    // New data
  console.log(data.event.old);    // Old data (UPDATE/DELETE)
});
```

## ✅ Success Checklist

- [ ] Server starts without errors
- [ ] Can access http://localhost:8001/health
- [ ] Test client connects successfully
- [ ] Can subscribe to channels
- [ ] Can send and receive messages
- [ ] Multiple clients can communicate
- [ ] Channel isolation works
- [ ] Logs show all events

## 🐛 Troubleshooting

### "Port 8001 is already in use"
Change port in `.env`:
```env
PORT=8002
```

### "Cannot find module 'express'"
Install dependencies:
```bash
npm install
```

### "Connection refused"
Make sure server is running:
```bash
npm run dev
```

### Test client not connecting
1. Check server is running
2. Check browser console for errors
3. Try http://localhost:8001/health in browser

## 🎉 What's Next?

### Phase 2: Database Integration
- Connect to PostgreSQL
- Listen for real database changes
- Broadcast actual data updates

### Phase 3: Authentication
- Add JWT validation
- User-specific channels
- Permission checks

### Phase 4: Production
- Add rate limiting
- Implement reconnection logic
- Add monitoring
- Load testing

## 📝 Quick Commands

```bash
# Install
npm install

# Start (dev mode with auto-reload)
npm run dev

# Start (production)
npm start

# Test health
curl http://localhost:8001/health

# View stats
curl http://localhost:8001/stats

# Open test client
start test/test-client.html
```

## 🎊 You're Done!

Your WebSocket server is now running and ready for real-time features!

**Next:** Integrate with your Zendbx backend to broadcast real database changes.

---

**Questions?** Check the logs - they show everything! 📋
