const { detectLanguage } = require('../src/languageDetectionService');

describe('Language Detection Service', () => {
  test('detects English text', () => {
    expect(detectLanguage('Fix bug in user login')).toBe('English');
  });

  test('detects Russian text', () => {
    expect(detectLanguage('Исправить ошибку в логине пользователя')).toBe('Russian');
  });

  test('detects mixed English and Russian text', () => {
    expect(detectLanguage('Fix ошибку в login')).toBe('Mixed');
  });

  test('detects transliterated Russian text', () => {
    expect(detectLanguage('Ispravit oshibku v logine polzovatelya')).toBe('Russian');
  });

  test('returns Unknown for empty or invalid input', () => {
    expect(detectLanguage('')).toBe('Unknown');
    expect(detectLanguage(null)).toBe('Unknown');
    expect(detectLanguage(undefined)).toBe('Unknown');
  });
});
