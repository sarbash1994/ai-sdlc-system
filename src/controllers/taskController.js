const Task = require('../models/task');

// Existing approve command handler
async function approveCommandHandler(req, res) {
  const { taskId } = req.body;
  try {
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    task.status = 'approved';
    await task.save();
    return res.json({ message: 'Task approved successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// New handler for approve button click
async function approveButtonHandler(req, res) {
  const { taskId } = req.body;
  try {
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    task.status = 'approved';
    await task.save();
    return res.json({ message: 'Task approved successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  approveCommandHandler,
  approveButtonHandler
};
