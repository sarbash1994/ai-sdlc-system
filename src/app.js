const express = require('express');
const mongoose = require('mongoose');
const clarifyingQuestionsRouter = require('./routes/clarifyingQuestions');

const app = express();

app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clarifying_questions', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Routes
app.use('/api/clarifying-questions', clarifyingQuestionsRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

module.exports = app;
