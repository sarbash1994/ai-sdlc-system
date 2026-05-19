const EventEmitter = require('events');

class MessagingSession extends EventEmitter {
  constructor(sessionId, agentIds) {
    super();
    this.sessionId = sessionId;
    this.agentIds = agentIds; // array of agent IDs participating
    this.messages = [];
    this.messageLimits = 5;
    this.startTime = Date.now();
    this.durationLimitMs = 10 * 60 * 1000; // 10 minutes
    this.agentMessageCount = {};
    agentIds.forEach(id => {
      this.agentMessageCount[id] = 0;
    });
    this.ended = false;
  }

  canSend(agentId) {
    if (this.ended) return false;
    if (!this.agentIds.includes(agentId)) return false;
    if (this.agentMessageCount[agentId] >= this.messageLimits) return false;
    if (Date.now() - this.startTime > this.durationLimitMs) {
      this.endSession();
      return false;
    }
    return true;
  }

  sendMessage(agentId, message) {
    if (!this.canSend(agentId)) {
      throw new Error('Message limit reached or session ended for agent ' + agentId);
    }
    const msgObj = {
      agentId,
      message,
      timestamp: Date.now()
    };
    this.messages.push(msgObj);
    this.agentMessageCount[agentId]++;
    this.emit('message', msgObj);
    if (this.agentMessageCount[agentId] >= this.messageLimits) {
      this.emit('agentLimitReached', agentId);
    }
    if (Date.now() - this.startTime > this.durationLimitMs) {
      this.endSession();
    }
    return msgObj;
  }

  getMessages() {
    return this.messages;
  }

  endSession() {
    if (!this.ended) {
      this.ended = true;
      this.endTime = Date.now();
      this.emit('sessionEnded', {
        sessionId: this.sessionId,
        startTime: this.startTime,
        endTime: this.endTime
      });
    }
  }

  isActive() {
    return !this.ended && (Date.now() - this.startTime <= this.durationLimitMs);
  }
}

module.exports = MessagingSession;
