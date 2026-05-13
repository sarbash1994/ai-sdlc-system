const express = require('express');
const router = express.Router();
const userPresenceService = require('../services/userPresenceService');

// Middleware to simulate authentication and get userId
function authMiddleware(req, res, next) {
  // For demonstration, assume userId is in header
  const userId = req.header('x-user-id');
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing user ID' });
  }
  req.userId = userId;
  next();
}

// Update user presence status
router.post('/presence', authMiddleware, (req, res) => {
  const { status, privacySettings } = req.body;
  if (!status || (status !== 'online' && status !== 'offline' && status !== 'away' && status !== 'busy')) {
    return res.status(400).json({ error: 'Invalid or missing status' });
  }

  userPresenceService.updateUserStatus(req.userId, status, privacySettings);
  res.status(200).json({ message: 'Presence updated' });
});

// Get user presence status
router.get('/presence/:userId', (req, res) => {
  const userId = req.params.userId;
  const status = userPresenceService.getUserStatus(userId);
  if (status === null) {
    return res.status(404).json({ error: 'User presence not found or not shared' });
  }
  res.json({ userId, status });
});

module.exports = router;
