const express = require('express');
const router = express.Router();
const messagingController = require('../messagingController');

// Create a new messaging session
router.post('/sessions', (req, res) => {
  try {
    const { sessionId, agentIds } = req.body;
    if (!sessionId || !Array.isArray(agentIds) || agentIds.length === 0) {
      return res.status(400).json({ error: 'sessionId and agentIds are required' });
    }
    messagingController.createSession(sessionId, agentIds);
    res.status(201).json({ message: 'Session created', sessionId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Send a message
router.post('/sessions/:sessionId/messages', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { agentId, message } = req.body;
    if (!agentId || !message) {
      return res.status(400).json({ error: 'agentId and message are required' });
    }
    const msgObj = messagingController.sendMessage(sessionId, agentId, message);
    res.status(201).json(msgObj);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all messages in a session
router.get('/sessions/:sessionId/messages', (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = messagingController.getMessages(sessionId);
    res.json(messages);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// End a session manually
router.post('/sessions/:sessionId/end', (req, res) => {
  try {
    const { sessionId } = req.params;
    messagingController.endSession(sessionId);
    res.json({ message: 'Session ended', sessionId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
