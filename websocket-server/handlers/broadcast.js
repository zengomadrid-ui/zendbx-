const logger = require('../utils/logger');
const channelManager = require('../utils/channels');

module.exports = function(socket, io) {
  // Send message to channel
  socket.on('send_message', ({ channel, message }) => {
    if (!channel || !message) {
      socket.emit('error', { 
        message: 'Channel and message are required',
        code: 'MISSING_PARAMS'
      });
      return;
    }
    
    // Check if socket is subscribed to the channel
    const subscribedChannels = channelManager.getSocketChannels(socket.id);
    if (!subscribedChannels.includes(channel)) {
      socket.emit('error', { 
        message: 'You must be subscribed to the channel to send messages',
        code: 'NOT_SUBSCRIBED'
      });
      return;
    }
    
    logger.info(`Broadcasting message to channel: ${channel}`, { 
      from: socket.id,
      messageType: typeof message
    });
    
    // Broadcast to all subscribers in the channel (including sender)
    io.to(channel).emit('receive_message', {
      channel,
      message,
      from: socket.id,
      timestamp: new Date().toISOString()
    });
  });
  
  // Database event simulation (for testing and future integration)
  socket.on('db_event', ({ channel, event }) => {
    if (!channel || !event) {
      socket.emit('error', { 
        message: 'Channel and event are required',
        code: 'MISSING_PARAMS'
      });
      return;
    }
    
    // Validate event structure
    if (!event.type || !['INSERT', 'UPDATE', 'DELETE'].includes(event.type)) {
      socket.emit('error', { 
        message: 'Event type must be INSERT, UPDATE, or DELETE',
        code: 'INVALID_EVENT_TYPE'
      });
      return;
    }
    
    logger.info(`Database event on channel: ${channel}`, { 
      type: event.type,
      table: event.table
    });
    
    // Broadcast database event to all subscribers
    io.to(channel).emit('db_change', {
      channel,
      event: {
        type: event.type,
        table: event.table || 'unknown',
        schema: event.schema || 'public',
        old: event.old || null,
        new: event.new || null,
        timestamp: new Date().toISOString()
      },
      from: socket.id
    });
  });
  
  // Broadcast to multiple channels
  socket.on('broadcast_multi', ({ channels, message }) => {
    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      socket.emit('error', { 
        message: 'Channels array is required',
        code: 'INVALID_CHANNELS'
      });
      return;
    }
    
    if (!message) {
      socket.emit('error', { 
        message: 'Message is required',
        code: 'MISSING_MESSAGE'
      });
      return;
    }
    
    const subscribedChannels = channelManager.getSocketChannels(socket.id);
    const validChannels = channels.filter(ch => subscribedChannels.includes(ch));
    
    if (validChannels.length === 0) {
      socket.emit('error', { 
        message: 'You are not subscribed to any of the specified channels',
        code: 'NOT_SUBSCRIBED'
      });
      return;
    }
    
    logger.info(`Broadcasting to multiple channels: ${validChannels.join(', ')}`, {
      from: socket.id
    });
    
    validChannels.forEach(channel => {
      io.to(channel).emit('receive_message', {
        channel,
        message,
        from: socket.id,
        timestamp: new Date().toISOString()
      });
    });
    
    socket.emit('broadcast_complete', {
      channels: validChannels,
      skipped: channels.filter(ch => !validChannels.includes(ch)),
      timestamp: new Date().toISOString()
    });
  });
};
