const express = require('express');
const router = express.Router();
const { approveCommandHandler, approveButtonHandler } = require('../controllers/taskController');

// Existing route for /approve command
router.post('/approve', approveCommandHandler);

// New route for approve button click
router.post('/approve-button', approveButtonHandler);

module.exports = router;
