const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const config = require('./config/config');
const logger = require('./utils/logger');
const channelManager = require('./utils/channels');
const connectionHandler = require('./handlers/connection');
const subscriptionHandler = require('./handlers/subscription');
const broadcastHandler = require('./handlers/broadcast');
const chatHandler = require('./handlers/chat');

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from test directory
app.use('/test', express.static(path.join(__dirname, 'test')));

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Zendbx WebSocket Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      stats: '/stats',
      channels: '/channels',
      broadcast: '/broadcast (POST)'
    }
  });
});

// Broadcast endpoint for backend to forward database events
// Protected by a shared secret header to prevent unauthenticated event injection.
app.post('/broadcast', (req, res) => {
  const internalSecret = process.env.INTERNAL_BROADCAST_SECRET;

  // Reject requests that don't present the correct internal secret
  if (!internalSecret || req.headers['x-internal-secret'] !== internalSecret) {
    logger.warn(`Unauthorized /broadcast attempt from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { event, channel, data } = req.body;
  
  if (!event || !channel || !data) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['event', 'channel', 'data']
    });
  }
  
  logger.info(`📡 Broadcasting ${event} to channel: ${channel}`, {
    table: data.table,
    operation: data.operation
  });
  
  // Broadcast to all clients subscribed to this channel
  io.to(channel).emit(event, {
    channel,
    ...data,
    timestamp: data.timestamp || new Date().toISOString()
  });
  
  // Also broadcast to a general realtime channel
  io.to('realtime:all').emit(event, {
    channel,
    ...data,
    timestamp: data.timestamp || new Date().toISOString()
  });
  
  res.json({
    success: true,
    event,
    channel,
    subscribers: io.sockets.adapter.rooms.get(channel)?.size || 0
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connections: io.engine.clientsCount,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Stats endpoint
app.get('/stats', (req, res) => {
  const rooms = Array.from(io.sockets.adapter.rooms.keys());
  const sockets = Array.from(io.sockets.sockets.keys());
  const channelStats = channelManager.getStats();
  
  res.json({
    totalConnections: sockets.length,
    activeChannels: channelStats.totalChannels,
    channels: channelStats.channels,
    rooms: rooms.filter(r => !sockets.includes(r)),
    timestamp: new Date().toISOString()
  });
});

// Channels endpoint
app.get('/channels', (req, res) => {
  const channelStats = channelManager.getStats();
  res.json({
    totalChannels: channelStats.totalChannels,
    channels: channelStats.channels,
    timestamp: new Date().toISOString()
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`New connection established: ${socket.id}`, {
    address: socket.handshake.address,
    time: socket.handshake.time
  });
  
  // Handle connection events
  connectionHandler(socket, io);
  
  // Handle subscription events
  subscriptionHandler(socket, io);
  
  // Handle broadcasting events
  broadcastHandler(socket, io);
  
  // Handle chat events
  chatHandler(socket, io);
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    logger.info(`Client disconnected: ${socket.id}`, { reason });
    
    // Clean up channel subscriptions
    channelManager.removeFromAllChannels(socket.id);
  });
  
  // Handle errors
  socket.on('error', (error) => {
    logger.error(`Socket error for ${socket.id}`, { error: error.message });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Express error:', { error: err.message });
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
server.listen(config.port, () => {
  logger.info(`🚀 Zendbx WebSocket Server started successfully`);
  logger.info(`📡 Server running on port ${config.port}`);
  logger.info(`🔗 WebSocket endpoint: ws://localhost:${config.port}`);
  logger.info(`💚 Health check: http://localhost:${config.port}/health`);
  logger.info(`📊 Stats: http://localhost:${config.port}/stats`);
  logger.info(`📺 Channels: http://localhost:${config.port}/channels`);
  logger.info(`🌍 CORS enabled for: ${config.corsOrigin}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server gracefully...');
  server.close(() => {
    logger.info('Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, closing server gracefully...');
  server.close(() => {
    logger.info('Server closed successfully');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', { reason, promise });
});

module.exports = { app, server, io };
