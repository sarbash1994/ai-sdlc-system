const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  sender: { type: String, required: true }, // agent ID
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  deliveredTo: [{ type: String }] // agent IDs who have received this message
});

module.exports = mongoose.model('Message', MessageSchema);
