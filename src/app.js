const express = require('express');
const bodyParser = require('body-parser');
const languageValidationRouter = require('./routes/languageValidation');

const app = express();

app.use(bodyParser.json());

app.use('/api/language', languageValidationRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
