const logger = require('../utils/logger');
const channelManager = require('../utils/channels');

module.exports = function(socket, io) {
  // Subscribe to channel
  socket.on('subscribe', (data) => {
    // Handle both string and object formats
    let channel;
    if (typeof data === 'string') {
      channel = data;
    } else if (data && typeof data === 'object' && data.channel) {
      channel = data.channel;
    } else {
      socket.emit('error', { 
        message: 'Invalid channel name',
        code: 'INVALID_CHANNEL'
      });
      return;
    }
    
    // Validate channel name format
    if (channel.length > 100 || !/^[a-zA-Z0-9_:-]+$/.test(channel)) {
      socket.emit('error', { 
        message: 'Channel name must be alphanumeric with _, :, or - (max 100 chars)',
        code: 'INVALID_CHANNEL_FORMAT'
      });
      return;
    }
    
    // Join the channel
    socket.join(channel);
    channelManager.addToChannel(channel, socket.id);
    
    const subscriberCount = channelManager.getChannelSubscriberCount(channel);
    
    logger.info(`Socket ${socket.id} subscribed to channel: ${channel} (${subscriberCount} subscribers)`);
    
    // Confirm subscription to the client
    socket.emit('subscribed', {
      channel,
      subscriberCount,
      timestamp: new Date().toISOString()
    });
    
    // Notify other subscribers about new member
    socket.to(channel).emit('subscriber_joined', {
      channel,
      subscriberCount,
      timestamp: new Date().toISOString()
    });
  });
  
  // Unsubscribe from channel
  socket.on('unsubscribe', (data) => {
    // Handle both string and object formats
    let channel;
    if (typeof data === 'string') {
      channel = data;
    } else if (data && typeof data === 'object' && data.channel) {
      channel = data.channel;
    } else {
      socket.emit('error', { 
        message: 'Invalid channel name',
        code: 'INVALID_CHANNEL'
      });
      return;
    }
    
    socket.leave(channel);
    channelManager.removeFromChannel(channel, socket.id);
    
    const subscriberCount = channelManager.getChannelSubscriberCount(channel);
    
    logger.info(`Socket ${socket.id} unsubscribed from channel: ${channel} (${subscriberCount} subscribers remaining)`);
    
    // Confirm unsubscription
    socket.emit('unsubscribed', {
      channel,
      subscriberCount,
      timestamp: new Date().toISOString()
    });
    
    // Notify remaining subscribers
    socket.to(channel).emit('subscriber_left', {
      channel,
      subscriberCount,
      timestamp: new Date().toISOString()
    });
  });
  
  // Get list of subscribed channels
  socket.on('get_subscriptions', () => {
    const channels = channelManager.getSocketChannels(socket.id);
    socket.emit('subscriptions', { 
      channels,
      count: channels.length,
      timestamp: new Date().toISOString()
    });
  });
  
  // Get channel info
  socket.on('get_channel_info', (channel) => {
    const subscriberCount = channelManager.getChannelSubscriberCount(channel);
    socket.emit('channel_info', {
      channel,
      subscriberCount,
      isSubscribed: channelManager.getSocketChannels(socket.id).includes(channel),
      timestamp: new Date().toISOString()
    });
  });
};
