# Zendbx WebSocket Server

Real-time communication layer for Zendbx using Node.js and Socket.io.

## 🚀 Quick Start

### Installation

```bash
cd websocket-server
npm install
```

### Running the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start on **port 8001** by default.

## 📡 Endpoints

- **WebSocket**: `ws://localhost:8001`
- **Health Check**: `http://localhost:8001/health`
- **Statistics**: `http://localhost:8001/stats`
- **Channels**: `http://localhost:8001/channels`

## 🧪 Testing

### Option 1: HTML Test Client (Recommended)

Open `test/test-client.html` in your browser:

```bash
# Windows
start test/test-client.html

# Mac
open test/test-client.html

# Linux
xdg-open test/test-client.html
```

### Option 2: Command Line

```bash
# Check health
curl http://localhost:8001/health

# Get stats
curl http://localhost:8001/stats

# Get channels
curl http://localhost:8001/channels
```

## 📚 WebSocket Events

### Client → Server

#### Connection
- `ping` - Health check ping
- `get_info` - Get client connection info

#### Subscription
- `subscribe` - Subscribe to a channel
  ```javascript
  socket.emit('subscribe', 'users');
  ```
- `unsubscribe` - Unsubscribe from a channel
  ```javascript
  socket.emit('unsubscribe', 'users');
  ```
- `get_subscriptions` - Get list of subscribed channels
- `get_channel_info` - Get info about a specific channel

#### Broadcasting
- `send_message` - Send message to a channel
  ```javascript
  socket.emit('send_message', {
    channel: 'users',
    message: 'Hello World'
  });
  ```
- `db_event` - Simulate database event
  ```javascript
  socket.emit('db_event', {
    channel: 'users',
    event: {
      type: 'INSERT',
      table: 'users',
      schema: 'public',
      new: { id: 1, name: 'John' }
    }
  });
  ```
- `broadcast_multi` - Broadcast to multiple channels

### Server → Client

#### Connection
- `connected` - Connection established
- `pong` - Response to ping
- `info` - Client connection information

#### Subscription
- `subscribed` - Successfully subscribed
- `unsubscribed` - Successfully unsubscribed
- `subscriber_joined` - New subscriber joined channel
- `subscriber_left` - Subscriber left channel
- `subscriptions` - List of subscribed channels
- `channel_info` - Channel information

#### Broadcasting
- `receive_message` - Received message from channel
- `db_change` - Database change event
- `broadcast_complete` - Multi-channel broadcast complete

#### Errors
- `error` - Error occurred

## 🎯 Usage Examples

### Basic Connection

```javascript
const socket = io('http://localhost:8001');

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('connected', (data) => {
  console.log('Server message:', data.message);
});
```

### Subscribe to Channel

```javascript
// Subscribe
socket.emit('subscribe', 'users');

// Listen for confirmation
socket.on('subscribed', (data) => {
  console.log(`Subscribed to ${data.channel}`);
  console.log(`Subscribers: ${data.subscriberCount}`);
});
```

### Send and Receive Messages

```javascript
// Send message
socket.emit('send_message', {
  channel: 'users',
  message: { text: 'Hello', user: 'John' }
});

// Receive messages
socket.on('receive_message', (data) => {
  console.log(`Message on ${data.channel}:`, data.message);
  console.log(`From: ${data.from}`);
});
```

### Database Events

```javascript
// Listen for database changes
socket.on('db_change', (data) => {
  console.log(`DB Event: ${data.event.type} on ${data.event.table}`);
  console.log('New data:', data.event.new);
  console.log('Old data:', data.event.old);
});
```

## 🏗️ Project Structure

```
websocket-server/
├── server.js              # Main entry point
├── package.json           # Dependencies
├── .env                   # Configuration
├── config/
│   └── config.js         # Config management
├── handlers/
│   ├── connection.js     # Connection handling
│   ├── subscription.js   # Subscription logic
│   └── broadcast.js      # Broadcasting logic
├── utils/
│   ├── logger.js         # Logging utility
│   └── channels.js       # Channel management
└── test/
    └── test-client.html  # HTML test client
```

## ⚙️ Configuration

Edit `.env` file:

```env
PORT=8001
CORS_ORIGIN=*
LOG_LEVEL=info
```

### Environment Variables

- `PORT` - Server port (default: 8001)
- `CORS_ORIGIN` - CORS origin (default: *)
- `LOG_LEVEL` - Logging level: error, warn, info, debug (default: info)

## 🧪 Testing Scenarios

### Test 1: Single Client

1. Open test client in browser
2. Click "Connect"
3. Subscribe to "users" channel
4. Send a test message
5. Verify message received

### Test 2: Multiple Clients

1. Open test client in 2 browser tabs
2. Connect both clients
3. Subscribe both to "users" channel
4. Send message from Client A
5. Verify both clients receive it

### Test 3: Channel Isolation

1. Client A subscribes to "users"
2. Client B subscribes to "posts"
3. Send message to "users"
4. Verify only Client A receives it

### Test 4: Database Events

1. Subscribe to a channel
2. Click "Send DB Event"
3. Verify DB event received with proper structure

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:8001/health
```

Response:
```json
{
  "status": "ok",
  "connections": 2,
  "uptime": 123.45,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Statistics

```bash
curl http://localhost:8001/stats
```

Response:
```json
{
  "totalConnections": 2,
  "activeChannels": 3,
  "channels": [
    { "name": "users", "subscribers": 2 },
    { "name": "posts", "subscribers": 1 }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🔧 Troubleshooting

### Port Already in Use

If port 8001 is already in use, change it in `.env`:

```env
PORT=8002
```

### Connection Refused

Make sure the server is running:

```bash
npm run dev
```

### CORS Issues

Update CORS origin in `.env`:

```env
CORS_ORIGIN=http://localhost:3000
```

## 🚀 Next Steps

### Phase 1: Database Integration (Future)
- Connect to PostgreSQL
- Listen for database changes (LISTEN/NOTIFY)
- Broadcast real database events

### Phase 2: Authentication (Future)
- JWT token validation
- User-specific channels
- Permission checking

### Phase 3: Production Ready (Future)
- Rate limiting
- Connection pooling
- Monitoring & metrics
- Error recovery
- Load testing

## 📝 Notes

- Server runs on port **8001** (FastAPI uses 8000)
- Channel names must be alphanumeric with `_`, `:`, or `-` (max 100 chars)
- Clients must be subscribed to a channel to send messages to it
- All events include timestamps
- Logs show all connection, subscription, and message events

## 🎉 Success Criteria

- ✅ Server starts without errors
- ✅ Clients can connect/disconnect
- ✅ Clients can subscribe to channels
- ✅ Messages broadcast to all channel subscribers
- ✅ Channel isolation works
- ✅ Multiple clients can connect simultaneously
- ✅ Logs show all events clearly
- ✅ Health endpoint returns stats

## 📞 Support

For issues or questions, check the logs:
- Server logs show all events
- Client logs in browser console
- Test client has visual event log

---

**Built with ❤️ for Zendbx**
