const franc = require('franc');
const translit = require('transliteration');

// Supported languages
const LANGUAGES = {
  en: 'English',
  ru: 'Russian'
};

/**
 * Detect language of given text, supporting English, Russian, mixed, and transliterated Russian.
 * @param {string} text
 * @returns {string} - 'English', 'Russian', 'Mixed', or 'Unknown'
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string') {
    return 'Unknown';
  }

  // Normalize text
  const normalizedText = text.trim();
  if (normalizedText.length === 0) {
    return 'Unknown';
  }

  // Detect language using franc
  let langCode = franc(normalizedText, { only: ['eng', 'rus'] });

  // If franc returns 'und' (undefined), try transliterated detection
  if (langCode === 'und') {
    // Transliterate text from Latin to Cyrillic
    const transliterated = translit.transliterate(normalizedText);
    langCode = franc(transliterated, { only: ['eng', 'rus'] });
  }

  // Map franc codes to our LANGUAGES
  let detectedLang = LANGUAGES[langCode] || 'Unknown';

  // Check for mixed language by splitting text into words and detecting individually
  const words = normalizedText.split(/\s+/);
  let hasEnglish = false;
  let hasRussian = false;

  for (const word of words) {
    let code = franc(word, { only: ['eng', 'rus'] });
    if (code === 'und') {
      // Try transliterated
      const translitWord = translit.transliterate(word);
      code = franc(translitWord, { only: ['eng', 'rus'] });
    }
    if (code === 'eng') hasEnglish = true;
    if (code === 'rus') hasRussian = true;
    if (hasEnglish && hasRussian) {
      detectedLang = 'Mixed';
      break;
    }
  }

  return detectedLang;
}

module.exports = {
  detectLanguage
};
