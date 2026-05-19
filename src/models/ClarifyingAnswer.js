const mongoose = require('mongoose');

const ClarifyingAnswerSchema = new mongoose.Schema({
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'ClarifyingQuestion', required: true },
  answerText: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ClarifyingAnswer', ClarifyingAnswerSchema);
