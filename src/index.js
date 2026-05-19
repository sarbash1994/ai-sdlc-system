const backgroundAgent = require('./backgroundAgent');

// Start the background agent
backgroundAgent.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping background agent...');
  backgroundAgent.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping background agent...');
  backgroundAgent.stop();
  process.exit(0);
});
