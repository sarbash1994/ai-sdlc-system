const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// Simple function to simulate PM response generation
function generatePMResponse(userMessage) {
  // For demonstration, PM echoes the message with a prefix
  return `PM Response: Received your message - "${userMessage}"`;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user_message', (msg) => {
    console.log(`Message from ${socket.id}:`, msg);

    // Generate PM response
    const pmResponse = generatePMResponse(msg);

    // Send PM response back to the user
    socket.emit('pm_response', pmResponse);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
