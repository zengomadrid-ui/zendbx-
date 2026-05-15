/**
 * Channel Management Utilities
 */

class ChannelManager {
  constructor() {
    this.channels = new Map(); // channel -> Set of socket IDs
  }

  /**
   * Add socket to channel
   */
  addToChannel(channel, socketId) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel).add(socketId);
  }

  /**
   * Remove socket from channel
   */
  removeFromChannel(channel, socketId) {
    if (this.channels.has(channel)) {
      this.channels.get(channel).delete(socketId);
      
      // Clean up empty channels
      if (this.channels.get(channel).size === 0) {
        this.channels.delete(channel);
      }
    }
  }

  /**
   * Remove socket from all channels
   */
  removeFromAllChannels(socketId) {
    for (const [channel, sockets] of this.channels.entries()) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.channels.delete(channel);
      }
    }
  }

  /**
   * Get all channels for a socket
   */
  getSocketChannels(socketId) {
    const channels = [];
    for (const [channel, sockets] of this.channels.entries()) {
      if (sockets.has(socketId)) {
        channels.push(channel);
      }
    }
    return channels;
  }

  /**
   * Get subscriber count for a channel
   */
  getChannelSubscriberCount(channel) {
    return this.channels.has(channel) ? this.channels.get(channel).size : 0;
  }

  /**
   * Get all active channels
   */
  getAllChannels() {
    return Array.from(this.channels.keys());
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      totalChannels: this.channels.size,
      channels: Array.from(this.channels.entries()).map(([channel, sockets]) => ({
        name: channel,
        subscribers: sockets.size
      }))
    };
  }
}

module.exports = new ChannelManager();
