const express = require('express');
const router = express.Router();
const Suggestion = require('../models/suggestion');
const sanitizeHtml = require('sanitize-html');

// Basic inappropriate content keywords for flagging
const inappropriateKeywords = ['spam', 'inappropriate', 'offensive'];

// Helper function to check for inappropriate content
function containsInappropriateContent(text) {
  const lowerText = text.toLowerCase();
  return inappropriateKeywords.some(keyword => lowerText.includes(keyword));
}

// POST /suggestions - submit a new suggestion
router.post('/', async (req, res) => {
  try {
    let { content, userId } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required and must be a non-empty string.' });
    }

    // Sanitize input to prevent XSS
    content = sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} }).trim();

    // Check for duplicates (exact content match)
    const existing = await Suggestion.findOne({ content });

    let flagged = containsInappropriateContent(content);

    const suggestionData = {
      content,
      flagged
    };

    if (userId) {
      suggestionData.userId = userId;
    }

    if (existing) {
      // Mark as duplicate
      suggestionData.duplicateOf = existing._id;
    }

    const suggestion = new Suggestion(suggestionData);
    await suggestion.save();

    res.status(201).json({ message: 'Suggestion submitted successfully.', suggestion });
  } catch (error) {
    console.error('Error submitting suggestion:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /suggestions - retrieve suggestions for admin with pagination and filtering
// Query params: page, limit, flagged (true/false), duplicate (true/false)
router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 10, flagged, duplicate } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    const filter = {};

    if (flagged === 'true') filter.flagged = true;
    else if (flagged === 'false') filter.flagged = false;

    if (duplicate === 'true') filter.duplicateOf = { $ne: null };
    else if (duplicate === 'false') filter.duplicateOf = null;

    const suggestions = await Suggestion.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const total = await Suggestion.countDocuments(filter);

    res.json({
      page,
      limit,
      total,
      suggestions
    });
  } catch (error) {
    console.error('Error retrieving suggestions:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
