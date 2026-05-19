const TelegramBot = require('node-telegram-bot-api');
const { detectLanguage } = require('../utils/languageDetection');

class TelegramMessageService {
  constructor(token) {
    this.bot = new TelegramBot(token, { polling: true });
    this.bot.on('message', this.handleMessage.bind(this));
  }

  async handleMessage(msg) {
    const chatId = msg.chat.id;
    const userMessage = msg.text;

    // Here we simulate agent response generation
    const agentResponse = await this.generateAgentResponse(userMessage);

    // Detect language of the agent response
    const lang = detectLanguage(agentResponse);

    if (lang !== 'ru') {
      // Block or flag the message
      await this.bot.sendMessage(chatId, 'Ошибка: ответ агента должен быть на русском языке.');
      // Optionally log or flag the incident
      console.warn(`Blocked non-Russian agent response: ${agentResponse}`);
      return;
    }

    // Send the agent response if it is in Russian
    await this.bot.sendMessage(chatId, agentResponse);
  }

  async generateAgentResponse(userMessage) {
    // Placeholder for actual agent response generation logic
    // For demonstration, echo the message but in Russian
    // In real implementation, integrate with agent backend or translation
    return this.translateToRussian(userMessage);
  }

  translateToRussian(text) {
    // Simple placeholder translation method
    // In production, integrate with a translation API or service
    // For now, just return the text assuming it is Russian or already translated
    return text;
  }
}

module.exports = TelegramMessageService;
