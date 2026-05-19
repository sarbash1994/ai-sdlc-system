const express = require('express');
const router = express.Router();
const { detectLanguage } = require('../languageDetectionService');

/**
 * POST /api/language/validate
 * Request body: { title: string, description: string }
 * Response: { titleLanguage: string, descriptionLanguage: string }
 */
router.post('/validate', (req, res) => {
  const { title, description } = req.body;

  if (typeof title !== 'string' || typeof description !== 'string') {
    return res.status(400).json({ error: 'Title and description must be strings.' });
  }

  const titleLanguage = detectLanguage(title);
  const descriptionLanguage = detectLanguage(description);

  res.json({
    titleLanguage,
    descriptionLanguage
  });
});

module.exports = router;
