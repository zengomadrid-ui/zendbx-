const logger = require('../utils/logger');
const channelManager = require('../utils/channels');

module.exports = function(socket, io) {
  // Join project chat room
  socket.on('join_project', (data) => {
    const { project_id } = data;
    
    if (!project_id) {
      socket.emit('error', { 
        message: 'project_id is required',
        code: 'MISSING_PROJECT_ID'
      });
      return;
    }
    
    const channel = `project:${project_id}`;
    
    // Join the channel
    socket.join(channel);
    channelManager.addToChannel(channel, socket.id);
    
    const subscriberCount = channelManager.getChannelSubscriberCount(channel);
    
    logger.info(`Socket ${socket.id} joined project: ${project_id} (${subscriberCount} members online)`);
    
    // Confirm join to the client
    socket.emit('project_joined', {
      project_id,
      channel,
      members_online: subscriberCount,
      timestamp: new Date().toISOString()
    });
    
    // Notify other members
    socket.to(channel).emit('user_joined', {
      project_id,
      members_online: subscriberCount,
      timestamp: new Date().toISOString()
    });
  });
  
  // Leave project chat room
  socket.on('leave_project', (data) => {
    const { project_id } = data;
    
    if (!project_id) {
      return;
    }
    
    const channel = `project:${project_id}`;
    
    socket.leave(channel);
    channelManager.removeFromChannel(channel, socket.id);
    
    const subscriberCount = channelManager.getChannelSubscriberCount(channel);
    
    logger.info(`Socket ${socket.id} left project: ${project_id} (${subscriberCount} members remaining)`);
    
    // Confirm leave
    socket.emit('project_left', {
      project_id,
      timestamp: new Date().toISOString()
    });
    
    // Notify remaining members
    socket.to(channel).emit('user_left', {
      project_id,
      members_online: subscriberCount,
      timestamp: new Date().toISOString()
    });
  });
  
  // Send chat message
  socket.on('send_message', (data) => {
    const { project_id, message } = data;
    
    if (!project_id || !message) {
      socket.emit('error', { 
        message: 'project_id and message are required',
        code: 'MISSING_PARAMS'
      });
      return;
    }
    
    const channel = `project:${project_id}`;
    
    // Check if socket is in the project channel
    const subscribedChannels = channelManager.getSocketChannels(socket.id);
    if (!subscribedChannels.includes(channel)) {
      socket.emit('error', { 
        message: 'You must join the project first',
        code: 'NOT_IN_PROJECT'
      });
      return;
    }
    
    logger.info(`Chat message in project ${project_id} from ${socket.id}`);
    
    // Broadcast to all members in the project (including sender)
    io.to(channel).emit('message_received', {
      project_id,
      message,
      from: socket.id,
      timestamp: new Date().toISOString()
    });
  });
  
  // Typing indicator
  socket.on('typing_start', (data) => {
    const { project_id, user_name } = data;
    
    if (!project_id) {
      return;
    }
    
    const channel = `project:${project_id}`;
    
    // Broadcast to others (not sender)
    socket.to(channel).emit('user_typing', {
      project_id,
      user_name: user_name || 'Someone',
      timestamp: new Date().toISOString()
    });
  });
  
  socket.on('typing_stop', (data) => {
    const { project_id, user_name } = data;
    
    if (!project_id) {
      return;
    }
    
    const channel = `project:${project_id}`;
    
    // Broadcast to others (not sender)
    socket.to(channel).emit('user_stopped_typing', {
      project_id,
      user_name: user_name || 'Someone',
      timestamp: new Date().toISOString()
    });
  });
};
