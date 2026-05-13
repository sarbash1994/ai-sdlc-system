const express = require('express');
const app = express();
const presenceRoutes = require('./routes/presenceRoutes');
const userPresenceService = require('./services/userPresenceService');

app.use(express.json());

app.use('/api', presenceRoutes);

// Start cleanup task for stale presence data
userPresenceService.startCleanupTask();

// Graceful shutdown
process.on('SIGINT', () => {
  userPresenceService.stopCleanupTask();
  process.exit();
});

module.exports = app;
