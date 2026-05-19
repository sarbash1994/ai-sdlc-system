const express = require('express');
const router = express.Router();
const ClarifyingQuestion = require('../models/ClarifyingQuestion');
const ClarifyingAnswer = require('../models/ClarifyingAnswer');

// Fetch all clarifying questions
router.get('/', async (req, res) => {
  try {
    const questions = await ClarifyingQuestion.find();
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clarifying questions' });
  }
});

// Submit answers for clarifying questions
router.post('/answers', async (req, res) => {
  const answers = req.body.answers; // expects [{ questionId, answerText }]

  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: 'Answers must be an array' });
  }

  try {
    // Validate completeness
    const questions = await ClarifyingQuestion.find();
    const requiredQuestions = questions.filter(q => q.required).map(q => q._id.toString());
    const answeredQuestionIds = answers.map(a => a.questionId);

    const missingRequired = requiredQuestions.filter(id => !answeredQuestionIds.includes(id));
    if (missingRequired.length > 0) {
      return res.status(400).json({ error: 'Missing answers for required questions', missingRequired });
    }

    // Validate ambiguity (simple check: answerText length > 3 and not empty)
    for (const ans of answers) {
      if (!ans.answerText || ans.answerText.trim().length < 3) {
        return res.status(400).json({ error: 'Ambiguous or incomplete answer detected', questionId: ans.questionId });
      }
    }

    // Store answers
    const savedAnswers = [];
    for (const ans of answers) {
      const answerDoc = new ClarifyingAnswer({
        question: ans.questionId,
        answerText: ans.answerText.trim()
      });
      await answerDoc.save();
      savedAnswers.push(answerDoc);
    }

    res.status(201).json({ message: 'Answers saved successfully', savedAnswers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save answers' });
  }
});

module.exports = router;
