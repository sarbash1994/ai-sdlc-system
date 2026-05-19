const franc = require('franc');

function detectLanguage(text) {
  // franc returns ISO 639-3 language code
  const langCode = franc(text, { minLength: 3 });
  // Map franc codes to ISO 639-1 for simplicity
  const iso6391Map = {
    'rus': 'ru'
  };
  return iso6391Map[langCode] || 'unknown';
}

module.exports = { detectLanguage };
