const { generateResponse } = require('../src/bot/responseGenerator');

const russianAlphabetRegex = /^[\u0400-\u04FF\s\.,!\?\-]+$/;

describe('generateResponse', () => {
  test('should return a non-empty string', () => {
    const response = generateResponse('Привет');
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  });

  test('should return response containing only Russian characters and punctuation', () => {
    for (let i = 0; i < 20; i++) {
      const response = generateResponse('Как дела?');
      expect(russianAlphabetRegex.test(response)).toBe(true);
    }
  });
});