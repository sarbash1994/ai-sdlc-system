const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Task = require('./models/task');
const Message = require('./models/message');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/realtime_messaging', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use(express.json());

// Middleware to check if agent is assigned to the task
async function verifyAgentInTask(taskId, agentId) {
  const task = await Task.findById(taskId);
  if (!task) return false;
  return task.assignedAgents.includes(agentId);
}

// REST endpoint to get message history for a task
app.get('/tasks/:taskId/messages', async (req, res) => {
  const { taskId } = req.params;
  const { agentId } = req.query;

  if (!agentId) {
    return res.status(400).json({ error: 'agentId query parameter required' });
  }

  const authorized = await verifyAgentInTask(taskId, agentId);
  if (!authorized) {
    return res.status(403).json({ error: 'Agent not authorized for this task' });
  }

  const messages = await Message.find({ taskId }).sort({ createdAt: 1 });
  res.json(messages);
});

// Socket.io connection handling
io.on('connection', (socket) => {
  // Client must send joinTask event with taskId and agentId to join room
  socket.on('joinTask', async ({ taskId, agentId }) => {
    if (!taskId || !agentId) {
      socket.emit('error', 'taskId and agentId required to join task');
      return;
    }

    const authorized = await verifyAgentInTask(taskId, agentId);
    if (!authorized) {
      socket.emit('error', 'Agent not authorized for this task');
      return;
    }

    socket.join(taskId);
    socket.data = { taskId, agentId };

    // Send undelivered messages to this agent
    const undeliveredMessages = await Message.find({ taskId, deliveredTo: { $ne: agentId } });
    undeliveredMessages.forEach(msg => {
      socket.emit('message', msg);
      // Mark as delivered to this agent
      if (!msg.deliveredTo.includes(agentId)) {
        msg.deliveredTo.push(agentId);
        msg.save();
      }
    });
  });

  // Handle incoming messages from agents
  socket.on('message', async (data) => {
    const { taskId, agentId } = socket.data || {};
    if (!taskId || !agentId) {
      socket.emit('error', 'You must join a task before sending messages');
      return;
    }

    // Validate message content
    if (!data || typeof data.text !== 'string' || data.text.trim() === '') {
      socket.emit('error', 'Invalid message content');
      return;
    }

    // Create and save message
    const message = new Message({
      taskId,
      sender: agentId,
      text: data.text.trim(),
      createdAt: new Date(),
      deliveredTo: [agentId] // sender has the message
    });

    await message.save();

    // Broadcast message to all agents in the task room except sender
    socket.to(taskId).emit('message', message);
  });

  socket.on('disconnect', () => {
    // No special handling needed here for offline queuing as undelivered messages are sent on join
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
