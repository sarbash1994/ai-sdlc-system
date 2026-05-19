const russianResponses = require('../data/russianResponses.json');

/**
 * Generates a bot response in Russian language only.
 * @param {string} userInput - The user's input message.
 * @returns {string} - The bot's response in Russian.
 */
function generateResponse(userInput) {
  // Basic example: select a random Russian response
  // In real scenario, this would be replaced by more complex logic
  const responses = russianResponses;
  const randomIndex = Math.floor(Math.random() * responses.length);
  return responses[randomIndex];
}

module.exports = { generateResponse };