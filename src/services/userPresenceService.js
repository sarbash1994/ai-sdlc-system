const EventEmitter = require('events');

class UserPresenceService extends EventEmitter {
  constructor() {
    super();
    this.userStatus = new Map(); // userId -> { status, lastUpdated, privacySettings }
    this.updateInterval = 5000; // 5 seconds
  }

  // Update user presence status
  updateUserStatus(userId, status, privacySettings = { sharePresence: true }) {
    if (!privacySettings.sharePresence) {
      // If user does not want to share presence, remove any existing status
      this.userStatus.delete(userId);
      this.emit('statusRemoved', userId);
      return;
    }

    const now = Date.now();
    this.userStatus.set(userId, { status, lastUpdated: now, privacySettings });
    this.emit('statusUpdated', userId, status);
  }

  // Get user presence status
  getUserStatus(userId) {
    const data = this.userStatus.get(userId);
    if (!data) return null;
    return data.status;
  }

  // Clean up stale statuses older than 10 minutes
  cleanupStaleStatuses() {
    const now = Date.now();
    for (const [userId, data] of this.userStatus.entries()) {
      if (now - data.lastUpdated > 10 * 60 * 1000) {
        this.userStatus.delete(userId);
        this.emit('statusRemoved', userId);
      }
    }
  }

  // Start periodic cleanup
  startCleanupTask() {
    this.cleanupTimer = setInterval(() => this.cleanupStaleStatuses(), 5 * 60 * 1000);
  }

  stopCleanupTask() {
    clearInterval(this.cleanupTimer);
  }
}

module.exports = new UserPresenceService();
