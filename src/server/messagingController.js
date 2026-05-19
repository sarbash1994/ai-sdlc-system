const MessagingSession = require('./messagingSession');

// In-memory sessions store (for demonstration, replace with DB in production)
const sessions = new Map();

function createSession(sessionId, agentIds) {
  if (sessions.has(sessionId)) {
    throw new Error('Session already exists');
  }
  const session = new MessagingSession(sessionId, agentIds);
  sessions.set(sessionId, session);
  return session;
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function sendMessage(sessionId, agentId, message) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  return session.sendMessage(agentId, message);
}

function getMessages(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  return session.getMessages();
}

function endSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.endSession();
  }
}

module.exports = {
  createSession,
  getSession,
  sendMessage,
  getMessages,
  endSession
};
