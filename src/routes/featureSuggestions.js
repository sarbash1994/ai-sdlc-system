const express = require('express');
const router = express.Router();
const FeatureSuggestion = require('../models/FeatureSuggestion');

// POST /api/feature-suggestions - submit a new feature suggestion
router.post('/', async (req, res) => {
  try {
    const { title, description, submittedBy } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }
    const suggestion = new FeatureSuggestion({ title, description, submittedBy });
    await suggestion.save();
    res.status(201).json({ message: 'Feature suggestion submitted successfully', suggestion });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/feature-suggestions - retrieve all suggestions for admin review
router.get('/', async (req, res) => {
  try {
    const suggestions = await FeatureSuggestion.find().sort({ createdAt: -1 });
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
