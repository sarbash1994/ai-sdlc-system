const mongoose = require('mongoose');

const ClarifyingQuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  required: { type: Boolean, default: true },
  options: [{ type: String }], // optional predefined options for answers
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ClarifyingQuestionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ClarifyingQuestion', ClarifyingQuestionSchema);
