const mongoose = require('mongoose');

const SuggestionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  content: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  flagged: { type: Boolean, default: false },
  duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Suggestion', default: null }
});

module.exports = mongoose.model('Suggestion', SuggestionSchema);
