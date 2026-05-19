const express = require('express');
const router = express.Router();

// Utility function to check if a string is English
function isEnglish(text) {
  if (!text || typeof text !== 'string') return false;
  // Regex to allow English letters, numbers, common punctuation and whitespace
  // Reject if any character is outside the basic English character set
  // This regex allows: a-z, A-Z, 0-9, common punctuation, spaces
  return /^[\x00-\x7F]*$/.test(text);
}

// Middleware to validate PR title and description
function validatePR(req, res, next) {
  const { title, description } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'PR title cannot be empty.' });
  }
  if (!description || description.trim() === '') {
    return res.status(400).json({ error: 'PR description cannot be empty.' });
  }

  if (!isEnglish(title)) {
    return res.status(400).json({ error: 'PR title must be in English only.' });
  }
  if (!isEnglish(description)) {
    return res.status(400).json({ error: 'PR description must be in English only.' });
  }

  next();
}

// Example route for creating a PR
router.post('/pr', validatePR, (req, res) => {
  // Assuming PR creation logic here
  res.status(201).json({ message: 'PR created successfully.' });
});

// Example route for updating a PR
router.put('/pr/:id', validatePR, (req, res) => {
  // Assuming PR update logic here
  res.status(200).json({ message: 'PR updated successfully.' });
});

module.exports = router;
