const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/realtime_messaging', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const messageSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  sender: { type: String, required: true }, // 'user' or 'assistant'
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  // Each client must join a session room
  socket.on('joinSession', async (sessionId) => {
    if (!sessionId) {
      socket.emit('error', 'Session ID is required to join');
      return;
    }
    socket.join(sessionId);

    // Load previous messages for this session
    try {
      const messages = await Message.find({ sessionId }).sort({ timestamp: 1 }).lean();
      socket.emit('previousMessages', messages);
    } catch (err) {
      socket.emit('error', 'Failed to load previous messages');
    }
  });

  // Handle incoming user message
  socket.on('userMessage', async ({ sessionId, content }) => {
    if (!sessionId || !content) {
      socket.emit('error', 'Session ID and content are required');
      return;
    }

    const userMessage = new Message({ sessionId, sender: 'user', content });
    try {
      await userMessage.save();
      // Broadcast user message to all in session
      io.to(sessionId).emit('newMessage', userMessage);

      // Simulate BA assistant response asynchronously
      setTimeout(async () => {
        const assistantContent = `BA assistant response to: ${content}`;
        const assistantMessage = new Message({ sessionId, sender: 'assistant', content: assistantContent });
        try {
          await assistantMessage.save();
          io.to(sessionId).emit('newMessage', assistantMessage);
        } catch (err) {
          io.to(sessionId).emit('error', 'Failed to deliver assistant response');
        }
      }, 1000); // simulate delay

    } catch (err) {
      socket.emit('error', 'Failed to save user message');
    }
  });

  // Handle disconnects gracefully
  socket.on('disconnect', () => {
    // No special cleanup needed for now
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
