const logger = require('../utils/logger');

module.exports = function(socket, io) {
  // Send welcome message
  socket.emit('connected', {
    socketId: socket.id,
    timestamp: new Date().toISOString(),
    message: 'Connected to Zendbx WebSocket server',
    version: '1.0.0'
  });
  
  logger.info(`Client connected: ${socket.id}`);
  
  // Handle ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong', { 
      timestamp: new Date().toISOString(),
      socketId: socket.id
    });
    logger.debug(`Ping received from ${socket.id}`);
  });
  
  // Handle client info request
  socket.on('get_info', () => {
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    socket.emit('info', {
      socketId: socket.id,
      connectedAt: socket.handshake.time,
      subscribedChannels: rooms,
      address: socket.handshake.address
    });
  });
};
