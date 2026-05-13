const mongoose = require('mongoose');

const FeatureSuggestionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  submittedBy: { type: String, default: 'anonymous' },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'reviewed', 'rejected', 'accepted'], default: 'pending' }
});

module.exports = mongoose.model('FeatureSuggestion', FeatureSuggestionSchema);
